import { getPayload } from "payload";
import payloadConfig from "@/payload.config";
import type { KnowledgeArticle } from "@/payload-types";

interface SearchKnowledgeBaseParams {
  query: string;
  callId?: string;
}

/**
 * Search knowledge articles using Payload's search plugin
 * Searches across indexed title, excerpt, and content fields
 */
export async function searchKnowledgeBase({ query, callId }: SearchKnowledgeBaseParams) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔧 FUNCTION: searchKnowledgeBase`);
  console.log(`📥 Input:`, { query, callId });

  if (!query || query.trim().length === 0) {
    console.log(`❌ Empty query provided`);
    console.log(`${"=".repeat(80)}\n`);
    return {
      success: false,
      error: "EMPTY_QUERY",
      message: "Please provide a question or search term",
    };
  }

  const payload = await getPayload({ config: payloadConfig });

  try {
    // Use the search plugin collection for optimized searching
    // This searches across title, excerpt, and content fields
    const { docs } = await payload.find({
      collection: "search",
      where: {
        or: [
          {
            title: {
              like: query,
            },
          },
          {
            excerpt: {
              like: query,
            },
          },
          {
            content: {
              like: query,
            },
          },
        ],
      },
      limit: 3, // Return top 3 results
      sort: "priority", // Sort by priority (lower number = higher priority)
    });

    if (docs.length === 0) {
      console.log(`📭 No articles found for query: "${query}"`);
      console.log(`${"=".repeat(80)}\n`);
      
      return {
        success: false,
        error: "NO_RESULTS",
        query,
        resultsFound: 0,
        message: "I couldn't find any articles matching your question",
        suggestion: "transfer_to_agent",
      };
    }

    // Return the best match from search results
    const searchResult = docs[0] as any; // Search plugin creates its own type
    
    // Extract content from the search result
    const content = searchResult.content || searchResult.excerpt || "";
    
    console.log(`✅ Found article: "${searchResult.title}"`);
    console.log(`   Priority: ${searchResult.priority}`);
    console.log(`   Total results: ${docs.length}`);
    console.log(`${"=".repeat(80)}\n`);

    return {
      success: true,
      articleFound: true,
      articleTitle: searchResult.title,
      content: content,
      excerpt: searchResult.excerpt,
      totalResults: docs.length,
      message: "Knowledge article found",
    };
  } catch (error) {
    console.error(`❌ Search error:`, error);
    console.log(`${"=".repeat(80)}\n`);
    
    return {
      success: false,
      error: "SEARCH_ERROR",
      query,
      message: "An error occurred while searching the knowledge base",
    };
  }
}
