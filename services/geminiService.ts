import { GoogleGenAI, Type, Schema } from "@google/genai";
import { DesignData, Message, GeoLocation, StructuralDetail } from "../types";
import { SYSTEM_INSTRUCTION, DETAIL_SYSTEM_INSTRUCTION } from "../constants";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Define the expected JSON Schema for the response
const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    chatResponse: {
      type: Type.STRING,
      description: "Engineering summary of the design and assumptions.",
    },
    projectTitle: {
      type: Type.STRING,
      description: "Technical project title.",
    },
    geoLocation: {
      type: Type.OBJECT,
      description: "Extracted real-world location coordinates if provided in context.",
      properties: {
        lat: { type: Type.NUMBER },
        lng: { type: Type.NUMBER },
        locationName: { type: Type.STRING, description: "City or Place Name" }
      },
      nullable: true
    },
    svgContent: {
      type: Type.STRING,
      description: "Inner SVG elements only (paths, lines, text). NO <svg> wrapper. Use marker-end='url(#arrow)' for dimensions.",
    },
    viewBox: {
      type: Type.STRING,
      description: "SVG viewBox (min-x min-y width height) with padding.",
    },
    reportMarkdown: {
      type: Type.STRING,
      description: "Markdown report: Parameters, Geometry, Specs, Code Compliance.",
    },
    billOfQuantities: {
      type: Type.OBJECT,
      description: "Bill of Quantities (Metrados).",
      properties: {
        items: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              itemCode: { type: Type.STRING },
              description: { type: Type.STRING },
              unit: { type: Type.STRING },
              quantity: { type: Type.NUMBER },
              remarks: { type: Type.STRING }
            },
            required: ["itemCode", "description", "unit", "quantity"]
          }
        },
        summary: {
          type: Type.OBJECT,
          properties: {
            totalConcreteVolume: { type: Type.NUMBER },
            totalSteelWeight: { type: Type.NUMBER },
            totalFormworkArea: { type: Type.NUMBER }
          },
          required: ["totalConcreteVolume", "totalSteelWeight", "totalFormworkArea"]
        }
      },
      required: ["items", "summary"]
    },
    files: {
      type: Type.ARRAY,
      description: "Export files.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          type: { type: Type.STRING, enum: ["dxf", "s2k", "csv", "txt"] },
          content: { type: Type.STRING },
          description: { type: Type.STRING }
        },
        required: ["name", "type", "content", "description"]
      }
    }
  },
  required: ["chatResponse", "projectTitle", "svgContent", "viewBox", "reportMarkdown", "billOfQuantities", "files"]
};

const detailSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        elementId: { type: Type.STRING },
        elementType: { type: Type.STRING },
        svgContent: { type: Type.STRING, description: "Inner SVG of the cross-section detail." },
        specifications: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "List of tech specs (e.g. '4 #5 Bars', 'Stirrups #3 @ 20cm')" 
        }
    },
    required: ["elementId", "elementType", "svgContent", "specifications"]
};

// Helper: Surveyor Agent (Grounding)
// Uses gemini-2.5-flash with googleMaps to "see" the site before the Engineer designs it.
async function fetchGroundedSiteData(lat: number, lng: number): Promise<string> {
  try {
    const surveyorModel = "gemini-2.5-flash";
    const result = await ai.models.generateContent({
      model: surveyorModel,
      contents: `Provide a detailed structural and architectural description of the site at latitude ${lat}, longitude ${lng}. 
      
      Focus on:
      1. Building Footprint Shape (Is it rectangular, triangular, irregular?).
      2. Visible layout (Is it a large open terminal, a residential house, a dense market?).
      3. Property boundaries and orientation.
      
      This description will be used to reconstruct a 2D CAD plan. Be precise about geometry.`,
      config: {
        tools: [{ googleMaps: {} }],
      }
    });
    
    return result.text || "No specific map data available. Proceed with coordinate inference.";
  } catch (error) {
    console.warn("Grounding Service Warning:", error);
    return "Map grounding temporarily unavailable. Using standard inference.";
  }
}

export const generateEngineeringDesign = async (
  prompt: string,
  history: Message[],
  projectDescription?: string,
  siteContext?: { lat: number, lng: number }
): Promise<DesignData & { chatResponse: string }> => {
  
  try {
    // Construct conversation history for context
    const relevantHistory = history.slice(-6).map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));

    // Inject Project Description & Site Context
    let effectivePrompt = prompt;
    
    if (siteContext) {
        // 1. Step 1: Grounding (Survey)
        const groundedData = await fetchGroundedSiteData(siteContext.lat, siteContext.lng);

        // 2. Step 2: Engineering (Design)
        effectivePrompt = `
        TASK: EXACT SITE RECONSTRUCTION (GROUNDED)
        LOCATION: ${siteContext.lat}, ${siteContext.lng}
        
        SURVEYOR DATA (GOOGLE MAPS):
        ${groundedData}
        
        CRITICAL INSTRUCTIONS:
        1. **GEOMETRY CHECK**: Use the SURVEYOR DATA above. If it says the site is a triangle or irregular, YOU MUST DRAW IT THAT WAY.
        2. **DO NOT SIMPLIFY**: Draw the EXACT property boundary as a polygon. Do NOT default to a rectangle if the data suggests otherwise.
        3. **INTERNAL GRID**: Layout the structural grid to match the described building density and orientation.
        4. **OUTPUT**: Professional CAD structural plan of the footprint.
        
        USER NOTES: ${prompt}
        `;
    } else if (projectDescription) {
        effectivePrompt = `PROJECT CONTEXT: ${projectDescription}\n\nREQUEST: ${prompt}`;
    }

    // Add the new user prompt
    const contents = [
      ...relevantHistory,
      { role: 'user', parts: [{ text: effectivePrompt }] }
    ];

    const modelId = "gemini-3-pro-preview"; 

    const result = await ai.models.generateContent({
      model: modelId,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        thinkingConfig: { thinkingBudget: 2048 } // Optimized for stability
      },
      contents: contents
    });

    let responseText = result.text;
    
    if (!responseText) {
      throw new Error("No response received from Gemini.");
    }

    // Clean potential markdown code blocks if the model adds them despite schema
    responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

    const data = JSON.parse(responseText);
    return data;

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const generateElementDetail = async (
    elementId: string,
    projectContext: string
): Promise<StructuralDetail> => {
    try {
        const modelId = "gemini-3-pro-preview";
        const prompt = `Generate a structural detail cross-section for element: "${elementId}". Context: ${projectContext}. Include reinforcement bars, stirrups, and dimensions.`;
        
        const result = await ai.models.generateContent({
            model: modelId,
            config: {
                systemInstruction: DETAIL_SYSTEM_INSTRUCTION,
                responseMimeType: "application/json",
                responseSchema: detailSchema,
                thinkingConfig: { thinkingBudget: 1024 }
            },
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        
        let responseText = result.text;
        if (!responseText) throw new Error("No detail response");
        
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(responseText);

    } catch (error) {
        console.error("Detail Generation Error:", error);
        throw error;
    }
};