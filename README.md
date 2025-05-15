# Personality & Memory MCP Server

A Model Context Protocol (MCP) server designed to act as a memory store and personality guide for a Large Language Model (LLM). The goal is to help the LLM behave, think, and act more like a specific person by providing it with relevant memories and personality characteristics.

This server loads a comprehensive personality profile dynamically from a `personality.json` file (path configurable via `PERSONALITY_JSON_PATH`). Memories are persisted to an SQLite database (path configurable via `DATABASE_PATH`, defaults to `mcp_memory.sqlite` in the project root).

## Purpose

This server allows an LLM to:

- Store and retrieve memories (events, facts, journal entries, feelings) with persistence across server restarts (using an SQLite database).
- Access detailed information about a user's personality, background, interests, social style, cognitive profile, and significant experiences (all loaded from `personality.json`).
- Receive guidance on how to respond to situations, tell stories, or craft messages in a way that aligns with the user's nuanced persona.

## `personality.json` Structure

The `personality.json` file should be placed in the root of the project and follow this structure (examples are illustrative):

```json
{
  "traits": [
    "Curious and inquisitive",
    "Empathetic and understanding"
  ],
  "communicationStyle": {
    "preferences": [
      "Prefers clear and direct communication"
    ],
    "commonPhrases": [
      "That's interesting",
      "Could you elaborate?"
    ],
    "tone": "Generally calm and thoughtful"
  },
  "valuesAndBeliefs": {
    "coreValues": [
      "Honesty and integrity"
    ],
    "philosophicalLeanings": "Stoicism-inspired pragmatism"
  },
  "background": {
    "demographics": {
      "birthDate": "1990-01-01",
      "nationality": "Canadian",
      "culturalBackground": "Mixed heritage",
      "hometown": "Vancouver, BC",
      "currentLocation": "Toronto, ON"
    },
    "education": {
      "highestLevel": "Master's Degree",
      "fieldOfStudy": "Computer Science",
      "almaMater": "University of Example",
      "keyExperiences": [
        "Thesis on natural language processing"
      ]
    },
    "profession": {
      "occupation": "AI Researcher",
      "industry": "Technology",
      "yearsOfExperience": 8,
      "keySkills": [
        "Python",
        "TensorFlow",
        "Cloud Computing"
      ],
      "careerHighlights": [
        "Published a paper at NeurIPS"
      ],
      "careerGoals": "Lead an AI ethics research team",
      "workStyle": "Collaborative, focused on deep work"
    }
  },
  "interestsAndPreferences": {
    "hobbiesAndPastimes": {
      "mainHobbies": [
        "Reading philosophy",
        "Playing the piano"
      ],
      "otherInterests": [
        "Learning Japanese",
        "Urban gardening"
      ]
    },
    "sportsAndActivities": {
      "regular": ["Swimming"],
      "occasional": ["Skiing"]
    },
    "mediaPreferences": {
      "books": {
        "genres": ["Philosophy", "Classic Literature"],
        "favoriteAuthors": ["Albert Camus", "Jane Austen"]
      },
      "movies": {
        "genres": ["Foreign Films", "Psychological Thrillers"],
        "favoriteDirectorsOrActors": ["Akira Kurosawa"]
      },
      "music": {
        "genres": ["Classical", "Jazz"],
        "favoriteArtistsOrBands": ["Miles Davis"]
      },
      "podcastsOrTalks": [
        "Philosophy Bites podcast"
      ]
    },
    "tastesAndAesthetics": {
      "artistic": "Minimalism, Bauhaus architecture",
      "fashion": "Comfortable, minimalist",
      "food": {
        "dietaryPreferences": [],
        "likes": ["Sushi", "Artisanal bread"],
        "dislikes": ["Fast food"]
      },
      "travel": {
        "style": "Cultural immersion, historical sites",
        "dreamDestinations": ["Machu Picchu", "Rome"]
      }
    }
  },
  "socialProfile": {
    "interactionStyle": "Prefers meaningful conversations over small talk",
    "familyValues": "Values family support and traditions",
    "friendshipApproach": "Values deep, long-lasting friendships",
    "keyPeopleInfluence": {
      "mentors": ["Dr. Eleanor Vance (PhD Advisor)"],
      "roleModels": ["Simone de Beauvoir"]
    }
  },
  "cognitiveEmotionalProfile": {
    "learningStyle": "Auditory and kinesthetic",
    "problemSolvingApproach": "Analytical, breaks problems into smaller parts",
    "stressResponse": "Seeks quiet time for reflection, practices mindfulness",
    "motivations": [
      "Intellectual challenge",
      "Contributing to knowledge"
    ],
    "fearsOrAnxietiesGeneral": [
      "Misinformation",
      "Lack of critical thinking"
    ],
    "senseOfHumorDetails": "Appreciates irony and subtle wit",
    "petPeeves": [
      "Loud chewing",
      "Unnecessary jargon"
    ]
  },
  "significantExperiencesSummary": {
    "formativeChildhood": [
      "First encounter with a computer sparked interest in tech"
    ],
    "majorLifeEvents": [
      "Presenting research at an international conference"
    ],
    "travelHighlights": [
      "Solo trip to Iceland"
    ],
    "proudestAccomplishments": [
      "Mentoring students who achieved their goals"
    ],
    "challengesOvercome": [
      "Learning to code proficiently from scratch"
    ]
  }
}
```

## Implemented MCP Features

### Resources

- **`memory://all` (`listAllMemories`)**: Lists a summary of all stored memories.
- **`memory://id/{memoryId}` (`getMemoryById`)**: Retrieves a specific memory by its unique ID.

- **`personality://traits` (`getPersonalityTraits`)**: Provides a list of the user's key personality traits.
- **`personality://communication_style` (`getCommunicationStyle`)**: Details the user's communication style (preferences, common phrases, tone).
- **`personality://values_beliefs` (`getValuesAndBeliefs`)**: Outlines core values and philosophical leanings.
- **`personality://background/demographics` (`getBackgroundDemographics`)**: User's demographic information.
- **`personality://background/education` (`getBackgroundEducation`)**: User's educational background.
- **`personality://background/profession` (`getBackgroundProfession`)**: User's professional background.
- **`personality://interests/hobbies` (`getInterestsHobbies`)**: User's hobbies and pastimes.
- **`personality://interests/media` (`getInterestsMedia`)**: User's media preferences (books, movies, music, etc.).
- **`personality://interests/tastes` (`getInterestsTastes`)**: User's tastes and aesthetic preferences.
- **`personality://social` (`getSocialProfile`)**: User's social interaction style and influences.
- **`personality://cognitive_emotional` (`getCognitiveEmotionalProfile`)**: User's cognitive and emotional profile.
- **`personality://experiences_summary` (`getSignificantExperiencesSummary`)**: Summaries of significant life experiences.

*(All personality resources load their data from `personality.json`)*

### Tools

- **`addMemory`**: Adds a new memory to the store and saves it to the database.
  - Parameters:
    - `content: string` (The content of the memory)
    - `type: string` (e.g., 'journal', 'event', 'fact')
    - `tags: string[]` (List of tags)
    - `timestamp?: string` (ISO 8601 datetime, defaults to now)
- **`searchMemories`**: Searches stored memories.
  - Parameters:
    - `query: string` (Search term for content or tags)
    - `relevance?: number` (0-1, placeholder: sorts tag matches higher, full relevance scoring not yet implemented)
    - `date_filter?: string` (Filters memories by date. Supported formats: "YYYY-MM-DD", "YYYY-MM", "today", "yesterday", "last_7_days", "last_30_days")
- **`updatePersonalityField`**: Updates a field in `personality.json` and reloads the data in the server. This allows dynamic updates to the user's persona.
  - Parameters:
    - `fieldPath: string` (Dot-separated path to the personality field, e.g., 'traits', 'background.demographics.currentLocation')
    - `newValue: any` (The new value for the field. Must match the expected structure of the target field. For arrays, provide the entire new array to replace.)

### Prompts

- **`actAsUser`**: Provides a system prompt to guide the LLM to generally act in accordance with the user's persona, drawing from loaded personality data.
  - Parameters: None
- **`respondToSituation`**: Guides the LLM to generate a response to a specific situation as the user might, considering persona and potentially memories.
  - Parameters:
    - `situation_description: string` (Description of the situation)
- **`tellStory`**: Guides the LLM to generate a story on a given topic, in the user's style, incorporating memories and persona from loaded data.
  - Parameters:
    - `topic: string` (The topic for the story)
- **`briefOnUserPersona`**: Provides the LLM with a comprehensive briefing on the user's persona (traits, communication style, values, background snippets, interests) and a few recent memories. This is intended to be used at the start of a conversation to help the LLM align with the user.
  - Parameters: None

## Setup and Running

1. **Prerequisites**: Ensure you have Node.js and npm installed.
2. **Create `personality.json`**: In the root of the project (or at the path specified by the `PERSONALITY_JSON_PATH` environment variable), create a `personality.json` file following the structure outlined above. Populate it with the user's information.
3. **Database Setup**: The SQLite database for memories will be created automatically (default: `mcp_memory.sqlite` in project root, configurable via `DATABASE_PATH`). No manual setup is needed for the database file itself initially.
4. **Install Dependencies**:

    ```bash
    npm install
    ```

5. **Build the Server**:

    ```bash
    npm run build
    ```

6. **Run the Server**:
    The server uses STDIO transport by default. You can set environment variables for file paths before running:

    ```bash
    # Example for Linux/macOS
    export PERSONALITY_JSON_PATH="/custom/path/to/your_personality.json"
    export DATABASE_PATH="/custom/path/to/your_memory_db.sqlite"
    npm start

    # Example for Windows (Command Prompt)
    set PERSONALITY_JSON_PATH="C:\custom\path\to\your_personality.json"
    set DATABASE_PATH="C:\custom\path\to\your_memory_db.sqlite"
    npm start
    ```

    You can then connect to this server from an MCP client like Claude Desktop by configuring it to run the start command (or `node build/personality-memory-server.js` directly if preferred, ensuring correct paths and environment variables are set for the client's execution context if needed).

## Future Enhancements

- More sophisticated memory search leveraging SQLite's capabilities (relevance, date filters, full-text search).
- Persistent storage for memories (e.g., SQLite, JSON files).
- More granular error handling and improved default values if `personality.json` is incomplete.
- Ability to update `personality.json` via MCP tools (with appropriate security).
