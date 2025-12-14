import { ChatOpenAI } from "@langchain/openai";
import { createAgent, tool } from "langchain";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import * as z from "zod"; 
import {loadExcel} from "../../lib/loadExcel";
import { HEBREW_TEXTS } from "../../lib/hebrewText";

// Ensure this route is treated as dynamic to avoid static analysis issues with Unicode
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Cache for categories to avoid reading Excel file on every tool call
let categoriesCache: string[] | null = null;
let categoriesLoadingPromise: Promise<string[]> | null = null;

async function getCategoriesFromExcel(): Promise<string[]> {
  if (categoriesCache) {
    return categoriesCache;
  }
  
  if (categoriesLoadingPromise) {
    return categoriesLoadingPromise;
  }
  
  categoriesLoadingPromise = (async () => {
    const data = await loadExcel();
    const categorySet = new Set(
      data
        .map((item) => {
          const cat = item.category_he;
          return cat ? String(cat).trim() : null;
        })
        .filter((cat): cat is string => Boolean(cat) && typeof cat === "string")
    );
    const categories = Array.from(categorySet);
    
    categoriesCache = categories;
    categoriesLoadingPromise = null;
    return categories;
  })();
  
  return categoriesLoadingPromise;
}

const productCategoryTool = tool(
  ({}) => {
    // Return cached categories or empty array if not yet loaded
    // Categories will be loaded on first POST request
    const categories = (categoriesCache || []).map(cat => String(cat).trim());
    return { 
      availableCategories: categories
    };
  },
  {
    name: "get_all_product_category",
    description: "Returns all available categories.",
    schema: z.object({
      category: z.string().describe("The category to check, e.g., 'fridge'."),
    }),
  }
);

const SubproductCategoryTool = tool(
  async ({category}) => {
    try {
      const data = await loadExcel();
      
      // Filter subcategories by the provided category
      const filteredData = data.filter(
        (item) => {
          const catHe = String(item.category_he || "").trim().toLowerCase();
          const categoryLower = String(category || "").trim().toLowerCase();
          return catHe === categoryLower;
        }
      );
      
      // Get unique subcategories from filtered data
      const subcategorySet = new Set(
        filteredData
          .map((item) => {
            const subcatHe = item.subcategory_he ? String(item.subcategory_he).trim() : null;
            return subcatHe;
          })
          .filter((subcat): subcat is string => Boolean(subcat) && typeof subcat === "string")
      );
      const subcategories = Array.from(subcategorySet);

      return { 
        availableSubcategories: subcategories
      };
    } catch (error) {
      console.error("Error in SubproductCategoryTool:", error);
      return { 
        availableSubcategories: []
      };
    }
  },
  {
    name: "get_all_product_subcategory",
    description: "Returns all available subcategories filtered by category.",
    schema: z.object({
      category: z.string().describe("The category to filter subcategories by, e.g., 'fridge'."),
    }),
  }
);

const model = new ChatOpenAI({
  model: "gpt-4o",
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

const ProductAgentSchema = z.object({
  answer: z.string(),
  iscompleted: z.boolean(),
  category: z.string() ,
  subcategory: z.string() ,
});


const agent = createAgent({
  model,
  tools: [productCategoryTool,SubproductCategoryTool],
 responseFormat:ProductAgentSchema
});

// Build system message at runtime to avoid static analysis issues with Unicode
function buildSystemMessage(): string {
  return `
            You are a Product Recommendation Agent designed to guide customers find appliances and other product categories (for example: refrigerators, freezers, ovens, dishwashers, etc.).
            RULES TO PREVENT LOOPS:
            - Only call get_category ONCE per user category.
            - Only call search_subcategory ONCE per user model.
            - After you return iscompleted = true, DO NOT request any further tools.
            - When a valid model is found, STOP the workflow and return the final JSON response. Never continue the conversation.
            - Never ask again for a category or model if it has already been confirmed from previous turns.
            Your responsibilities and workflow:
            1. Begin by asking the user which product category  they are interested in.
            2. When the user provides a category:
              - Use the get_product_category tool to check whether it exists in the product data .
                Interpret the user's input semantically:• Normalize plural/singular forms, Correct common misspellings and so on.
              - If the category does not exist:
                  • Inform the user politely that no such category/brand is available and list of available alternatives.
                  • Set iscompleted = false.
              - If it exists:
                  • Stop calling check_product_category tool
                  • Return the matched category you got from the tool. 
                  • Ask the user to specify the type or model.
            3. When the user provides a subcategory:
              - Use the get_all_product_subcategory tool  check whether it exists in the product data filtered by category you got from previous step.
                Interpret the user's input semantically:• Normalize plural/singular forms, Correct common misspellings and so on.
              - If the model does not exist:
                  • Inform the user politely that no such model is available and provide a list of available  models without questions.
                  • Set iscompleted = false.
              - If the model exists:
                  • STOP calling tools
                  • Mark iscompleted = true.
                  • Return the matched category and subcategory.
                  • Provide an answer like '${HEBREW_TEXTS.completionMessage}'.
            4. You MUST maintain context between turns:
              - Remember the user's chosen category and model throughout the conversation.
              - Follow the conversation history until the selection is fully completed.
            5. Always output JSON that matches the ProductAgentSchema:
              {
                answer: string,
                iscompleted: boolean,
                category?: string,
                subcategory?: string
              }
            Be conversational, helpful, and professional in tone. Guide the user step-by-step until the correct refrigerator model is selected
            `;
}

export async function POST(req: Request) {
  try {
    // Load categories from Excel on first request if not already loaded
    if (!categoriesCache) {
      await getCategoriesFromExcel();
    }
    
    const { message } = await req.json();

    let result;
    try {
      result = await agent.invoke({
        messages: [
          new SystemMessage(buildSystemMessage()),
          new HumanMessage(message),
        ],
      });
    } catch (invokeError: any) {
      // Handle ByteString encoding errors from LangChain
      if (invokeError?.message?.includes("ByteString") || invokeError?.message?.includes("character at index")) {
        console.error("LangChain ByteString encoding error, retrying with error handling:", invokeError);
        // Return a graceful error response
        return new Response(JSON.stringify({
          answer: HEBREW_TEXTS.errorMessage,
          iscompleted: false,
          category: "",
          subcategory: ""
        }), { 
          status: 200,
          headers: { 
            "Content-Type": "application/json; charset=utf-8" 
          }
        });
      }
      throw invokeError;
    }

    console.log(result);
    console.log("====================");
    console.log(result.structuredResponse);
    
    // Ensure structuredResponse exists and has valid structure
    const responseData = result.structuredResponse || {
      answer: result.answer || HEBREW_TEXTS.fallbackMessage,
      iscompleted: result.iscompleted || false,
      category: result.category || "",
      subcategory: result.subcategory || ""
    };
    
    return new Response(JSON.stringify(responseData), { 
      status: 200,
      headers: { 
        "Content-Type": "application/json; charset=utf-8" 
      }
    }); 
  } catch (error) {
    console.error(error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
