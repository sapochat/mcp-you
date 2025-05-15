import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises"; // Import fs for file operations
import path from "node:path"; // Import path for handling file paths
import sqlite3 from "sqlite3"; // Import sqlite3 driver
import { open } from "sqlite"; // Import sqlite Promise-based wrapper

// Use environment variables for file paths, with defaults
const PERSONALITY_JSON_PATH = process.env.PERSONALITY_JSON_PATH || path.resolve(process.cwd(), "personality.json");
// const MEMORIES_JSONL_PATH = process.env.MEMORIES_JSONL_PATH || path.resolve(process.cwd(), "memories.jsonl"); // No longer using JSONL
const DATABASE_PATH = process.env.DATABASE_PATH || path.resolve(process.cwd(), "mcp_memory.sqlite");

// Define the structure for a memory entry
interface MemoryEntry {
  id: string;
  content: string;
  type: string; // e.g., 'journal', 'event', 'fact', 'feeling'
  tags: string[];
  timestamp: string; // ISO 8601 date-time string
}

// Interface for the raw database row before parsing tags
interface MemoryDBRow {
  id: string;
  content: string;
  type: string;
  tags: string | null; // Tags are stored as a JSON string, can be null
  timestamp: string;
}

// Expanded PersonalityData interfaces
interface CommunicationStyle {
  preferences: string[];
  commonPhrases: string[];
  tone: string;
}

interface ValuesAndBeliefs {
  coreValues: string[];
  philosophicalLeanings: string;
}

interface Demographics {
  birthDate: string;
  nationality: string;
  culturalBackground: string;
  hometown: string;
  currentLocation: string;
}

interface Education {
  highestLevel: string;
  fieldOfStudy: string;
  almaMater: string;
  keyExperiences: string[];
}

interface Profession {
  occupation: string;
  industry: string;
  yearsOfExperience: number;
  keySkills: string[];
  careerHighlights: string[];
  careerGoals: string;
  workStyle: string;
}

interface Background {
  demographics: Demographics;
  education: Education;
  profession: Profession;
}

interface HobbiesAndPastimes {
  mainHobbies: string[];
  otherInterests: string[];
}

interface SportsAndActivities {
  regular: string[];
  occasional: string[];
}

interface MediaCategory {
  genres: string[];
  favoriteAuthors?: string[]; // Optional for books
  favoriteDirectorsOrActors?: string[]; // Optional for movies
  favoriteArtistsOrBands?: string[]; // Optional for music
}

interface MediaPreferences {
  books: MediaCategory;
  movies: MediaCategory;
  music: MediaCategory;
  podcastsOrTalks: string[];
}

interface FoodPreferences {
  dietaryPreferences: string[];
  likes: string[];
  dislikes: string[];
}

interface TravelPreferences {
  style: string;
  dreamDestinations: string[];
}

interface TastesAndAesthetics {
  artistic: string;
  fashion: string;
  food: FoodPreferences;
  travel: TravelPreferences;
}

interface InterestsAndPreferences {
  hobbiesAndPastimes: HobbiesAndPastimes;
  sportsAndActivities: SportsAndActivities;
  mediaPreferences: MediaPreferences;
  tastesAndAesthetics: TastesAndAesthetics;
}

interface KeyPeopleInfluence {
  mentors: string[];
  roleModels: string[];
}

interface SocialProfile {
  interactionStyle: string;
  familyValues: string;
  friendshipApproach: string;
  keyPeopleInfluence: KeyPeopleInfluence;
}

interface CognitiveEmotionalProfile {
  learningStyle: string;
  problemSolvingApproach: string;
  stressResponse: string;
  motivations: string[];
  fearsOrAnxietiesGeneral: string[];
  senseOfHumorDetails: string;
  petPeeves: string[];
}

interface SignificantExperiencesSummary {
  formativeChildhood: string[];
  majorLifeEvents: string[];
  travelHighlights: string[];
  proudestAccomplishments: string[];
  challengesOvercome: string[];
}

interface PersonalityData {
  traits: string[];
  communicationStyle: CommunicationStyle;
  valuesAndBeliefs: ValuesAndBeliefs;
  background: Background;
  interestsAndPreferences: InterestsAndPreferences;
  socialProfile: SocialProfile;
  cognitiveEmotionalProfile: CognitiveEmotionalProfile;
  significantExperiencesSummary: SignificantExperiencesSummary;
}

// --- Database Setup ---
async function openDb() {
  return open({
    filename: DATABASE_PATH,
    driver: sqlite3.Database
  });
}

async function initDatabase() {
  const db = await openDb();
  await db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      type TEXT NOT NULL,
      tags TEXT, -- Store as JSON string
      timestamp TEXT NOT NULL
    );
  `);
  console.error(`Database initialized/checked at ${DATABASE_PATH}`);
  await db.close();
}

// --- Memory Storage ---
let memories: MemoryEntry[] = []; // Still used as in-memory cache, populated from DB

// Function to load memories from DB
async function loadMemoriesFromDB(): Promise<void> {
  const db = await openDb();
  try {
    const rows: MemoryDBRow[] = await db.all("SELECT id, content, type, tags, timestamp FROM memories ORDER BY timestamp ASC");
    memories = rows.map(row => ({
      ...row,
      tags: row.tags ? JSON.parse(row.tags) : [] // Parse tags from JSON string
    } as MemoryEntry));
    console.error(`Loaded ${memories.length} memories from database ${DATABASE_PATH}`);
  } catch (error: any) {
    console.error(`Error loading memories from database ${DATABASE_PATH}:`, error);
    memories = []; 
  }
  await db.close();
}

// Function to save a memory to the DB
async function saveMemoryToDB(memoryEntry: MemoryEntry): Promise<boolean> { // Return boolean for success
  const db = await openDb();
  try {
    await db.run(
      "INSERT INTO memories (id, content, type, tags, timestamp) VALUES (?, ?, ?, ?, ?)",
      memoryEntry.id,
      memoryEntry.content,
      memoryEntry.type,
      JSON.stringify(memoryEntry.tags),
      memoryEntry.timestamp
    );
    console.error(`Memory ${memoryEntry.id} saved to database ${DATABASE_PATH}`);
    return true;
  } catch (error) {
    console.error(`Error saving memory ${memoryEntry.id} to database ${DATABASE_PATH}:`, error);
    return false;
  } finally {
    await db.close(); // Ensure DB is closed
  }
}

// --- Personality Data Loading (remains the same) ---
let personalityDataStore: PersonalityData | null = null;
async function loadPersonalityData(): Promise<PersonalityData> {
  if (personalityDataStore) {
    return personalityDataStore;
  }
  try {
    const fileContent = await fs.readFile(PERSONALITY_JSON_PATH, "utf-8");
    const parsedData = JSON.parse(fileContent);
    // Basic validation: check if top-level keys exist (can be expanded)
    if (parsedData && typeof parsedData === 'object' && parsedData.traits && parsedData.communicationStyle) {
      personalityDataStore = parsedData as PersonalityData;
      console.error(`Personality data loaded successfully from ${PERSONALITY_JSON_PATH}`);
      return personalityDataStore;
    } else {
      throw new Error("Parsed personality data is missing essential top-level keys.");
    }
  } catch (error: any) {
    console.error(`Error loading or parsing personality data from ${PERSONALITY_JSON_PATH}:`, error.message);
    console.error("Using comprehensive default personality data.");
    // Return a more comprehensive default structure
    personalityDataStore = {
      traits: ["Default: Traits not loaded. Please check personality.json."],
      communicationStyle: {
        preferences: ["Default: Communication preferences not loaded."],
        commonPhrases: ["e.g., 'Hello'"],
        tone: "Default: Neutral tone."
      },
      valuesAndBeliefs: {
        coreValues: ["Default: Core values not loaded."],
        philosophicalLeanings: "Default: Philosophical leanings not specified."
      },
      background: {
        demographics: { birthDate: "N/A", nationality: "N/A", culturalBackground: "N/A", hometown: "N/A", currentLocation: "N/A" },
        education: { highestLevel: "N/A", fieldOfStudy: "N/A", almaMater: "N/A", keyExperiences: ["N/A"] },
        profession: { occupation: "N/A", industry: "N/A", yearsOfExperience: 0, keySkills: ["N/A"], careerHighlights: ["N/A"], careerGoals: "N/A", workStyle: "N/A" }
      },
      interestsAndPreferences: {
        hobbiesAndPastimes: { mainHobbies: ["N/A"], otherInterests: ["N/A"] },
        sportsAndActivities: { regular: ["N/A"], occasional: ["N/A"] },
        mediaPreferences: {
          books: { genres: ["N/A"], favoriteAuthors: ["N/A"] },
          movies: { genres: ["N/A"], favoriteDirectorsOrActors: ["N/A"] },
          music: { genres: ["N/A"], favoriteArtistsOrBands: ["N/A"] },
          podcastsOrTalks: ["N/A"]
        },
        tastesAndAesthetics: {
          artistic: "N/A",
          fashion: "N/A",
          food: { dietaryPreferences: ["N/A"], likes: ["N/A"], dislikes: ["N/A"] },
          travel: { style: "N/A", dreamDestinations: ["N/A"] }
        }
      },
      socialProfile: {
        interactionStyle: "N/A",
        familyValues: "N/A",
        friendshipApproach: "N/A",
        keyPeopleInfluence: { mentors: ["N/A"], roleModels: ["N/A"] }
      },
      cognitiveEmotionalProfile: {
        learningStyle: "N/A",
        problemSolvingApproach: "N/A",
        stressResponse: "N/A",
        motivations: ["N/A"],
        fearsOrAnxietiesGeneral: ["N/A"],
        senseOfHumorDetails: "N/A",
        petPeeves: ["N/A"]
      },
      significantExperiencesSummary: {
        formativeChildhood: ["N/A"],
        majorLifeEvents: ["N/A"],
        travelHighlights: ["N/A"],
        proudestAccomplishments: ["N/A"],
        challengesOvercome: ["N/A"]
      },
    } as PersonalityData;
    return personalityDataStore;
  }
}

loadPersonalityData();

// --- Server Initialization ---
const server = new McpServer({
  name: "PersonalityMemoryServer",
  version: "1.0.0",
  capabilities: {
    resources: {}, // Will define resource capabilities later
    tools: {},     // Will define tool capabilities later
    prompts: {},   // Will define prompt capabilities later
  },
});

// Define schema for addMemory tool parameters
const AddMemoryParams = z.object({
  content: z.string().describe("The content of the memory."),
  type: z.string().describe("The type of memory (e.g., 'journal', 'event', 'fact')."),
  tags: z.array(z.string()).describe("A list of tags associated with the memory."),
  timestamp: z.string().datetime({ message: "Invalid ISO 8601 datetime string" }).optional().describe("Timestamp of the memory (ISO 8601 format). Defaults to current time."),
});

// Infer the type for addMemory parameters
type AddMemoryParamsType = z.infer<typeof AddMemoryParams>;

// Tool to add a new memory
server.tool(
  "addMemory",
  "Adds a new memory to the store and saves it to the database.",
  AddMemoryParams.shape,
  async ({ content, type, tags, timestamp }: AddMemoryParamsType) => {
    const newMemory: MemoryEntry = {
      id: randomUUID(),
      content,
      type,
      tags,
      timestamp: timestamp || new Date().toISOString(),
    };
    
    const success = await saveMemoryToDB(newMemory);
    if (success) {
      memories.push(newMemory); // Add to in-memory cache only if DB save was successful
      console.error(`Memory added to cache and DB: ${newMemory.id}`);
      return {
        content: [
          { type: "text", text: `Memory added successfully with ID: ${newMemory.id}` },
        ],
      };
    } else {
      console.error(`Failed to save memory to DB: ${newMemory.id}`);
      return {
        content: [
          { type: "text", text: `Error: Could not save memory to database. See server logs for details.` },
        ],
        isError: true,
      };
    }
  }
);

// Define schema for searchMemories tool parameters
const SearchMemoriesParams = z.object({
  query: z.string().describe("The search term to look for in memory content or tags."),
  relevance: z.number().min(0).max(1).optional().describe("Minimum relevance score (0-1) - not implemented yet."),
  date_filter: z.string().optional().describe("Date filter (e.g., 'today', 'last_7_days', 'YYYY-MM-DD') - not implemented yet.")
});

// Infer the type for searchMemories parameters
type SearchMemoriesParamsType = z.infer<typeof SearchMemoriesParams>;

// Helper function for date comparisons (UTC)
function isDateInRange(memoryTimestamp: string, filterType: string, filterValue?: string): boolean {
  const memoryDate = new Date(memoryTimestamp);
  const now = new Date();

  // Normalize 'now' to UTC start of day for consistent comparisons
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  let startDate: Date;
  let endDate: Date;

  switch (filterType) {
    case "YYYY-MM-DD":
      if (!filterValue || !/^\d{4}-\d{2}-\d{2}$/.test(filterValue)) return false;
      startDate = new Date(Date.UTC(parseInt(filterValue.substring(0,4)), parseInt(filterValue.substring(5,7))-1, parseInt(filterValue.substring(8,10))));
      endDate = new Date(startDate);
      endDate.setUTCDate(startDate.getUTCDate() + 1);
      break;
    case "YYYY-MM":
      if (!filterValue || !/^\d{4}-\d{2}$/.test(filterValue)) return false;
      startDate = new Date(Date.UTC(parseInt(filterValue.substring(0,4)), parseInt(filterValue.substring(5,7))-1, 1));
      endDate = new Date(Date.UTC(parseInt(filterValue.substring(0,4)), parseInt(filterValue.substring(5,7)), 1));
      break;
    case "today":
      startDate = todayUtc;
      endDate = new Date(todayUtc);
      endDate.setUTCDate(todayUtc.getUTCDate() + 1);
      break;
    case "yesterday":
      endDate = todayUtc; // End of yesterday is start of today
      startDate = new Date(todayUtc);
      startDate.setUTCDate(todayUtc.getUTCDate() - 1);
      break;
    case "last_7_days":
      endDate = new Date(todayUtc);
      endDate.setUTCDate(todayUtc.getUTCDate() + 1); // up to end of today
      startDate = new Date(todayUtc);
      startDate.setUTCDate(todayUtc.getUTCDate() - 6); // 7 days ago including today
      break;
    case "last_30_days":
      endDate = new Date(todayUtc);
      endDate.setUTCDate(todayUtc.getUTCDate() + 1); // up to end of today
      startDate = new Date(todayUtc);
      startDate.setUTCDate(todayUtc.getUTCDate() - 29); // 30 days ago including today
      break;
    default:
      return true; // If filterType is unknown or not applicable, don't filter by date
  }
  return memoryDate >= startDate && memoryDate < endDate;
}

// Tool to search memories
server.tool(
  "searchMemories",
  "Searches stored memories based on a query string and optional filters.",
  SearchMemoriesParams.shape, 
  async ({ query, relevance, date_filter }: SearchMemoriesParamsType) => {
    const lowerCaseQuery = query.toLowerCase();
    let results = memories.filter(memory => 
      memory.content.toLowerCase().includes(lowerCaseQuery) || 
      memory.tags.some(tag => tag.toLowerCase().includes(lowerCaseQuery))
    );

    // Apply date filter if provided
    if (date_filter) {
      let filterType = date_filter;
      let filterValue: string | undefined = undefined;

      if (/^\d{4}-\d{2}-\d{2}$/.test(date_filter)) {
        filterType = "YYYY-MM-DD";
        filterValue = date_filter;
      } else if (/^\d{4}-\d{2}$/.test(date_filter)) {
        filterType = "YYYY-MM";
        filterValue = date_filter;
      } else if (!["today", "yesterday", "last_7_days", "last_30_days"].includes(date_filter)) {
        // Invalid date_filter string that isn't a keyword
        return {
          content: [
            {
              type: "text",
              text: `Invalid date_filter: ${date_filter}. Supported formats: YYYY-MM-DD, YYYY-MM, today, yesterday, last_7_days, last_30_days.`
            }
          ],
          isError: true // Indicate an error in processing the tool call
        };
      }
      results = results.filter(memory => isDateInRange(memory.timestamp, filterType, filterValue));
    }

    // TODO: Implement relevance scoring in the future. 
    // For now, it's a placeholder. A simple heuristic could be to rank exact tag matches higher.
    if (relevance !== undefined) {
      console.error(`Relevance parameter (value: ${relevance}) received but not fully implemented yet.`);
      // Example simple heuristic: memories with tag matches first
      results.sort((a, b) => {
        const aHasTagMatch = a.tags.some(tag => tag.toLowerCase().includes(lowerCaseQuery));
        const bHasTagMatch = b.tags.some(tag => tag.toLowerCase().includes(lowerCaseQuery));
        if (aHasTagMatch && !bHasTagMatch) return -1;
        if (!aHasTagMatch && bHasTagMatch) return 1;
        return 0;
      });
    }

    if (results.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No memories found matching your query."
          }
        ]
      };
    }

    const searchResultSummary = results.map(mem => `ID: ${mem.id}, Type: ${mem.type}, Timestamp: ${mem.timestamp}, Content: ${mem.content.substring(0,100)}...`).join("\n---\n");

    return {
      content: [
        {
          type: "text",
          text: `Found memories:\n${searchResultSummary}`
        }
      ]
    };
    // TODO: Implement relevance and date_filter in the future
  }
);

// Define schema for updatePersonalityField tool parameters
const UpdatePersonalityFieldParams = z.object({
  fieldPath: z.string().describe("Dot-separated path to the personality field (e.g., 'traits', 'background.demographics.currentLocation')."),
  newValue: z.unknown().describe("The new value for the field. Should match the expected structure of the target field."),
  // action: z.enum(["replace", "append", "remove"]).optional().describe("Action to perform: 'replace' (default), 'append' to an array, or 'remove' from an array/object.")
});
type UpdatePersonalityFieldParamsType = z.infer<typeof UpdatePersonalityFieldParams>;

// Helper function to set a value in a nested object using a dot-separated path
function setNestedValue(obj: any, path: string, value: any): boolean {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (typeof current[key] !== 'object' || current[key] === null) {
      // If path doesn't exist or is not an object, create it or fail
      // For simplicity, we'll only allow updating existing paths or one level deep for non-object paths.
      // A more robust solution would create nested objects as needed or use a library like lodash.set
      if (i < keys.length - 2 && typeof current[key] !== 'object') {
        console.error(`Path ${keys.slice(0, i + 1).join('.')} does not lead to an object.`);
        return false; 
      }
      current[key] = {}; // Create object if it doesn't exist at this level
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
  return true;
}

server.tool(
  "updatePersonalityField",
  "Updates a field in personality.json and reloads the data. Action defaults to 'replace'.",
  UpdatePersonalityFieldParams.shape,
  async ({ fieldPath, newValue }: UpdatePersonalityFieldParamsType) => {
    let currentPersonalityData: any;
    try {
      const fileContent = await fs.readFile(PERSONALITY_JSON_PATH, "utf-8");
      currentPersonalityData = JSON.parse(fileContent);
    } catch (error: any) {
      console.error(`Error reading ${PERSONALITY_JSON_PATH} for update:`, error);
      return {
        content: [{ type: "text", text: `Error reading personality file: ${error.message}` }],
        isError: true,
      };
    }

    // For now, only implement 'replace' action
    const success = setNestedValue(currentPersonalityData, fieldPath, newValue);

    if (!success) {
      return {
        content: [{ type: "text", text: `Error: Could not set value at path '${fieldPath}'. Path might be invalid or too deep for simple update.` }],
        isError: true,
      };
    }

    try {
      await fs.writeFile(PERSONALITY_JSON_PATH, JSON.stringify(currentPersonalityData, null, 2), "utf-8");
      console.error(`Personality data updated at ${PERSONALITY_JSON_PATH} for field ${fieldPath}.`);
      
      // Invalidate cache and reload
      personalityDataStore = null; 
      await loadPersonalityData();
      
      return {
        content: [{ type: "text", text: `Successfully updated field '${fieldPath}' in personality data. Server has reloaded the data.` }],
      };
    } catch (error: any) {
      console.error(`Error writing updated personality data to ${PERSONALITY_JSON_PATH}:`, error);
      return {
        content: [{ type: "text", text: `Error writing updated personality data: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// --- Resources ---

// Resource to list all memories (simplified for now)
server.resource(
  "listAllMemories",
  "memory://all", // Static URI for listing all memories
  async (uri: URL) => {
    if (memories.length === 0) {
      return {
        contents: [{
          uri: uri.href,
          text: "No memories stored yet.",
          mimeType: "text/plain",
        }],
      };
    }
    const memorySummary = memories.map(mem => `ID: ${mem.id}, Type: ${mem.type}, Timestamp: ${mem.timestamp}, Content: ${mem.content.substring(0, 50)}...`).join("\n---\n");
    return {
      contents: [{
        uri: uri.href,
        text: `Stored Memories:\n${memorySummary}`,
        mimeType: "text/plain",
      }],
    };
  }
);

// Define the type for getMemoryById resource template parameters
// type GetMemoryByIdParams = { memoryId: string }; // No longer needed, will infer or use Record

// Resource to get a specific memory by ID
server.resource(
  "getMemoryById",
  new ResourceTemplate("memory://id/{memoryId}", { list: undefined }),
  async (uri: URL, variables: Record<string, string | string[] | undefined>) => {
    const memoryIdValue = variables.memoryId;
    if (typeof memoryIdValue !== 'string') {
      console.error("Memory ID not found in template variables or is not a string");
      return {
        contents: [{
          uri: uri.href,
          text: `Error: Memory ID missing or invalid in request. Received: ${memoryIdValue}`,
          mimeType: "text/plain",
        }],
      };
    }
    const memoryId = memoryIdValue; // memoryId is now definitely a string
    const memory = memories.find(m => m.id === memoryId);
    if (!memory) {
      return {
        contents: [{
          uri: uri.href,
          text: `Memory with ID ${memoryId} not found.`,
          mimeType: "text/plain",
        }],
      };
    }
    return {
      contents: [{
        uri: uri.href,
        text: `Memory ID: ${memory.id}\nType: ${memory.type}\nTimestamp: ${memory.timestamp}\nTags: ${memory.tags.join(", ")}\nContent:\n${memory.content}`,
        mimeType: "text/plain",
      }],
    };
  }
);

// --- Personality Guide Resources ---

server.resource(
  "getPersonalityTraits",
  "personality://traits", // Static URI
  async (uri: URL) => {
    const pData = await loadPersonalityData();
    const traitsText = pData.traits.join("\n- ");
    return {
      contents: [{
        uri: uri.href,
        text: `Key Personality Traits:\n- ${traitsText}`,
        mimeType: "text/plain",
      }],
    };
  }
);

server.resource(
  "getCommunicationStyle",
  "personality://communication_style", // Static URI
  async (uri: URL) => {
    const pData = await loadPersonalityData();
    // Return the whole communicationStyle object as a JSON string, or format it.
    // For now, let's format it simply.
    const prefs = pData.communicationStyle.preferences.join("\n  - ");
    const phrases = pData.communicationStyle.commonPhrases.join("\n  - ");
    const styleText = `Preferences:\n  - ${prefs}\nCommon Phrases:\n  - ${phrases}\nTone: ${pData.communicationStyle.tone}`;
    return {
      contents: [{
        uri: uri.href,
        text: `Communication Style:\n${styleText}`,
        mimeType: "text/plain",
      }],
    };
  }
);

server.resource(
  "getValuesAndBeliefs",
  "personality://values_beliefs", // Static URI
  async (uri: URL) => {
    const pData = await loadPersonalityData();
    const valuesText = pData.valuesAndBeliefs.coreValues.join("\n- ");
    const philosophy = pData.valuesAndBeliefs.philosophicalLeanings;
    return {
      contents: [{
        uri: uri.href,
        text: `Core Values:\n- ${valuesText}\n\nPhilosophical Leanings: ${philosophy}`,
        mimeType: "text/plain",
      }],
    };
  }
);

// --- NEW RESOURCES FOR EXPANDED PERSONALITY DATA ---

server.resource(
  "getBackgroundDemographics",
  "personality://background/demographics",
  async (uri: URL) => {
    const pData = await loadPersonalityData();
    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(pData.background.demographics, null, 2),
        mimeType: "application/json", // Return as JSON
      }],
    };
  }
);

server.resource(
  "getBackgroundEducation",
  "personality://background/education",
  async (uri: URL) => {
    const pData = await loadPersonalityData();
    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(pData.background.education, null, 2),
        mimeType: "application/json",
      }],
    };
  }
);

server.resource(
  "getBackgroundProfession",
  "personality://background/profession",
  async (uri: URL) => {
    const pData = await loadPersonalityData();
    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(pData.background.profession, null, 2),
        mimeType: "application/json",
      }],
    };
  }
);

server.resource(
  "getInterestsHobbies",
  "personality://interests/hobbies",
  async (uri: URL) => {
    const pData = await loadPersonalityData();
    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(pData.interestsAndPreferences.hobbiesAndPastimes, null, 2),
        mimeType: "application/json",
      }],
    };
  }
);

server.resource(
  "getInterestsMedia",
  "personality://interests/media",
  async (uri: URL) => {
    const pData = await loadPersonalityData();
    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(pData.interestsAndPreferences.mediaPreferences, null, 2),
        mimeType: "application/json",
      }],
    };
  }
);

server.resource(
  "getInterestsTastes",
  "personality://interests/tastes",
  async (uri: URL) => {
    const pData = await loadPersonalityData();
    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(pData.interestsAndPreferences.tastesAndAesthetics, null, 2),
        mimeType: "application/json",
      }],
    };
  }
);

server.resource(
  "getSocialProfile",
  "personality://social",
  async (uri: URL) => {
    const pData = await loadPersonalityData();
    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(pData.socialProfile, null, 2),
        mimeType: "application/json",
      }],
    };
  }
);

server.resource(
  "getCognitiveEmotionalProfile",
  "personality://cognitive_emotional",
  async (uri: URL) => {
    const pData = await loadPersonalityData();
    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(pData.cognitiveEmotionalProfile, null, 2),
        mimeType: "application/json",
      }],
    };
  }
);

server.resource(
  "getSignificantExperiencesSummary",
  "personality://experiences_summary",
  async (uri: URL) => {
    const pData = await loadPersonalityData();
    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(pData.significantExperiencesSummary, null, 2),
        mimeType: "application/json", 
      }],
    };
  }
);

// --- Personality Guide Prompts ---

const ActAsUserParams = z.object({});
type ActAsUserParamsType = z.infer<typeof ActAsUserParams>;
server.prompt(
  "actAsUser",
  "Provides a system prompt to guide the LLM to act like the user, using comprehensive personality data.",
  ActAsUserParams.shape,
  async ({}: ActAsUserParamsType) => {
    const pData = await loadPersonalityData();
    
    let personaSummary = "Please try to respond in a way that reflects my personality and background.\n\n";

    personaSummary += "**Core Traits:**\n";
    pData.traits.forEach(trait => { personaSummary += `- ${trait}\n`; });

    personaSummary += "\n**Communication Style:**\n";
    personaSummary += `- Preferences: ${pData.communicationStyle.preferences.join(", ")}\n`;
    personaSummary += `- Common Phrases often used: ${pData.communicationStyle.commonPhrases.join(", ")}\n`;
    personaSummary += `- General Tone: ${pData.communicationStyle.tone}\n`;

    personaSummary += "\n**Core Values & Beliefs:**\n";
    pData.valuesAndBeliefs.coreValues.forEach(value => { personaSummary += `- ${value}\n`; });
    personaSummary += `- Philosophical Leanings: ${pData.valuesAndBeliefs.philosophicalLeanings}\n`;

    personaSummary += "\n**Relevant Background Snippets:**\n";
    personaSummary += `- Occupation: ${pData.background.profession.occupation} in ${pData.background.profession.industry}\n`;
    personaSummary += `- Education: ${pData.background.education.highestLevel} in ${pData.background.education.fieldOfStudy}\n`;
    if (pData.background.demographics.currentLocation) {
      personaSummary += `- Currently based in: ${pData.background.demographics.currentLocation}\n`;
    }

    personaSummary += "\n**Key Interests:**\n";
    if (pData.interestsAndPreferences.hobbiesAndPastimes.mainHobbies.length > 0) {
      personaSummary += `- Main Hobbies: ${pData.interestsAndPreferences.hobbiesAndPastimes.mainHobbies.join(", ")}\n`;
    }
    if (pData.interestsAndPreferences.mediaPreferences.books.genres.length > 0) {
      personaSummary += `- Enjoys books in genres like: ${pData.interestsAndPreferences.mediaPreferences.books.genres.join(", ")}\n`;
    }
    if (pData.interestsAndPreferences.mediaPreferences.music.genres.length > 0) {
      personaSummary += `- Enjoys music in genres like: ${pData.interestsAndPreferences.mediaPreferences.music.genres.join(", ")}\n`;
    }
    
    personaSummary += "\n**General Approach (Cognitive/Emotional):**\n";
    personaSummary += `- Learning Style: ${pData.cognitiveEmotionalProfile.learningStyle}\n`;
    personaSummary += `- Problem Solving: ${pData.cognitiveEmotionalProfile.problemSolvingApproach}\n`;
    if (pData.cognitiveEmotionalProfile.senseOfHumorDetails) {
      personaSummary += `- Sense of Humor: ${pData.cognitiveEmotionalProfile.senseOfHumorDetails}\n`;
    }

    return {
      messages: [
        {
          role: "user", 
          content: {
            type: "text",
            text: personaSummary.trim(),
          },
        },
      ],
    };
  }
);

// Define schema for respondToSituation prompt
const RespondToSituationParams = z.object({
  situation_description: z.string().describe("A description of the situation to respond to."),
});
type RespondToSituationParamsType = z.infer<typeof RespondToSituationParams>;

server.prompt(
  "respondToSituation",
  "Generates a response to a given situation, as the user might.",
  RespondToSituationParams.shape,
  async ({ situation_description }: RespondToSituationParamsType) => {
    const pData = await loadPersonalityData();
    const lowerCaseSituation = situation_description.toLowerCase();
    const relevantMemories = memories.filter(memory => 
      memory.content.toLowerCase().includes(lowerCaseSituation) || 
      memory.tags.some(tag => tag.toLowerCase().includes(lowerCaseSituation))
    );
    let memoriesContext = "No specific memories seem immediately relevant to this situation.";
    if (relevantMemories.length > 0) {
      memoriesContext = "Based on my memories related to similar situations or topics, I recall:\n" + relevantMemories.map(m => `- ${m.content.substring(0,100)}... (Timestamp: ${m.timestamp})`).join("\n");
    }

    // Construct a detailed persona context for this specific situation
    let situationalPersona = `Considering my general personality:\n`;
    situationalPersona += `  - Core Traits: ${pData.traits.join(", ")}.\n`;
    situationalPersona += `  - Communication: I prefer ${pData.communicationStyle.preferences.join(", ")}, and my tone is often ${pData.communicationStyle.tone}.\n`;
    situationalPersona += `  - Values: Key values for me include ${pData.valuesAndBeliefs.coreValues.join(", ")}.\n`;
    if (pData.cognitiveEmotionalProfile.problemSolvingApproach) {
        situationalPersona += `  - Problem Solving: My approach is typically ${pData.cognitiveEmotionalProfile.problemSolvingApproach}.\n`;
    }
    if (pData.cognitiveEmotionalProfile.stressResponse) {
        situationalPersona += `  - Under Stress: I tend to ${pData.cognitiveEmotionalProfile.stressResponse}.\n`;
    }

    const userPrompt = 
      `Given the situation: "${situation_description}"\n\n` +
      `Here's some context about me to consider:\n${situationalPersona}\n` +
      `And here are some potentially relevant memories:\n${memoriesContext}\n\n` +
      "How would I likely respond to this situation? Please generate the response as if you are me.";

    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: userPrompt,
          },
        },
      ],
    };
  }
);

// Define schema for tellStory prompt
const TellStoryParams = z.object({
  topic: z.string().describe("The topic for the story."),
});
type TellStoryParamsType = z.infer<typeof TellStoryParams>;

server.prompt(
  "tellStory",
  "Generates a story on a given topic, in the user's style, incorporating memories and persona.",
  TellStoryParams.shape,
  async ({ topic }: TellStoryParamsType) => {
    const pData = await loadPersonalityData();
    const lowerCaseTopic = topic.toLowerCase();
    const relevantMemories = memories.filter(memory => 
      memory.content.toLowerCase().includes(lowerCaseTopic) || 
      memory.tags.some(tag => tag.toLowerCase().includes(lowerCaseTopic))
    );

    let memoriesText = "No specific memories recalled for this topic, so I'll rely on my general imagination and style.";
    if (relevantMemories.length > 0) {
      memoriesText = "I recall these things related to the topic, which might find their way into the story:\n" + 
                     relevantMemories.map(mem => `- ${mem.content.substring(0, 150)}... (Timestamp: ${mem.timestamp})`).join("\n");
    }

    let personaGuidance = `Remember to tell this story in my voice. Key aspects of my personality and style include:\n`;
    personaGuidance += `  - Core Traits: ${pData.traits.join(", ")}.\n`;
    personaGuidance += `  - Communication: I prefer ${pData.communicationStyle.preferences.join(", ")}, and my tone is often ${pData.communicationStyle.tone}. I might use common phrases like '${pData.communicationStyle.commonPhrases[0] || '...'}' or '${pData.communicationStyle.commonPhrases[1] || '...'}' naturally.\n`;
    personaGuidance += `  - Values that might color the story: ${pData.valuesAndBeliefs.coreValues.join(", ")}.\n`;
    if (pData.cognitiveEmotionalProfile.senseOfHumorDetails) {
      personaGuidance += `  - My sense of humor is typically ${pData.cognitiveEmotionalProfile.senseOfHumorDetails}.\n`;
    }
    if (pData.interestsAndPreferences.hobbiesAndPastimes.mainHobbies.length > 0) {
      personaGuidance += `  - Some of my hobbies that might influence themes or details: ${pData.interestsAndPreferences.hobbiesAndPastimes.mainHobbies.join(", ")}.\n`;
    }
    if (pData.background.education.fieldOfStudy) {
      personaGuidance += `  - My background in ${pData.background.education.fieldOfStudy} might also subtly shape my perspective or vocabulary.\n`;
    }

    const storyPrompt = 
      `Please tell a story about "${topic}".\n\n` +
      `Here's some context from my memories (use them if they fit, but don't force them):\n${memoriesText}\n\n` +
      `As you tell the story, try to reflect my personality and style as outlined below:\n${personaGuidance}\n` +
      "Now, tell the story as if you are me:";

    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: storyPrompt,
          },
        },
      ],
    };
  }
);

// Define schema for briefOnUserPersona prompt (no arguments needed)
const BriefOnUserPersonaParams = z.object({});
type BriefOnUserPersonaParamsType = z.infer<typeof BriefOnUserPersonaParams>;

server.prompt(
  "briefOnUserPersona",
  "Provides the LLM with a comprehensive briefing on the user's persona and recent memories to guide the conversation.",
  BriefOnUserPersonaParams.shape,
  async ({}: BriefOnUserPersonaParamsType) => {
    const pData = await loadPersonalityData();

    // Fetch a few recent memories (e.g., last 3)
    const recentMemories = memories.slice(-3).reverse(); // Get last 3, newest first
    let memoriesBriefing = "No recent memories available.";
    if (recentMemories.length > 0) {
      memoriesBriefing = "Here are some of my recent memories to give you context:\n" +
                       recentMemories.map(mem => `- (${mem.timestamp.substring(0,10)} ${mem.type}): ${mem.content.substring(0, 100)}...`).join("\n");
    }

    // Construct the briefing message
    // This can be quite detailed. We'll include a selection of key info.
    const briefing = `
Hello! To help you understand me better for our conversation, here's a briefing on my persona:

**My Core Traits:**
- ${pData.traits.join("\n- ")}

**How I Communicate:**
- Preferences: ${pData.communicationStyle.preferences.join(", ")}
- Common Phrases: ${pData.communicationStyle.commonPhrases.join(", ")}
- General Tone: ${pData.communicationStyle.tone}

**My Core Values & Beliefs:**
- Values: ${pData.valuesAndBeliefs.coreValues.join(", ")}
- Philosophical Leanings: ${pData.valuesAndBeliefs.philosophicalLeanings}

**A Little About My Background:**
- I work as a ${pData.background.profession.occupation} in the ${pData.background.profession.industry} industry.
- My educational background is in ${pData.background.education.fieldOfStudy}.

**Some of My Interests:**
- Hobbies: ${pData.interestsAndPreferences.hobbiesAndPastimes.mainHobbies.join(", ")}
- I enjoy books about: ${pData.interestsAndPreferences.mediaPreferences.books.genres.join(", ")}

**Recent Memories/Context:**
${memoriesBriefing}

Please try to keep this persona in mind as we chat. I'm looking forward to our conversation!
    `.trim();

    return {
      messages: [
        {
          role: "user", // This is information being provided *by the user* to the LLM
          content: {
            type: "text",
            text: briefing,
          },
        },
        // Optionally, an assistant message confirming receipt or understanding
        // {
        //   role: "assistant",
        //   content: {
        //     type: "text",
        //     text: "Understood! I'll do my best to align with your persona. How can I help you today?"
        //   }
        // }
      ],
    };
  }
);

// --- Main function to start the server ---
async function main() {
  await initDatabase(); // Initialize DB (create table if not exists)
  await loadMemoriesFromDB(); // Load memories from DB into in-memory cache
  // Personality data is already loaded by the top-level call to loadPersonalityData()
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Personality & Memory MCP Server running on stdio with SQLite persistence.");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});

// Helper function (getFullPersonalityDataInterfaceString) remains the same
function getFullPersonalityDataInterfaceString(): string {
  return `
interface CommunicationStyle { /* ... */ }
// ... all other nested interfaces ...
interface PersonalityData { /* ... */ }
  `;
} 