/**
 * Does all the AI interaction on the server side using React Server
 * Components.
 */

import {
  createStreamableUI,
  createAI,
  getMutableAIState,
  render,
} from "ai/rsc";
import axios from "axios";
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: "",
  baseURL: `${process.env.LLM_API_URL}/v1`,
});

/**
 * Generates an AI Character profile with an image, name and other attributes.
 */
async function generateDebater(imagePrompt: string) {
  "use server";

  // Lets us update state the client side needs.
  const aiState = getMutableAIState<typeof AI>();

  // The initial response that we'll update later.
  // /
  const uiStream = createStreamableUI(
    <div className="inline-flex gap-1">
      <p className="mb-2">Creating a debator with prompt {imagePrompt}</p>
    </div>
  );

  (async () => {
    // Let's generate a not super good character profile image.
    const itemId = "debate-rater-test";
    const request = {
      id: itemId,
      prompt: imagePrompt,
      negative_prompt: "",
      lora: "BricksStyle",
      num_inference_steps: 15,
    };
    const { data } = await axios.post(
      `${process.env.IMAGE_API_URL}/sdxl/generate`,
      request
    );
    const image = data.image;

    // Update the AI state with the image for safe keeping.
    aiState.update(({ messages, context }) => ({
      messages,
      context: {
        ...context,
        itemId,
        image,
      },
    }));

    // Let the client know about the image.
    uiStream.update(
      <div className="inline-flex gap-1">
        <figure className="h-[256px]  w-[256px]">
          <img src={image} />
        </figure>
        <div>Creating their personality...</div>
      </div>
    );

    // Now generate a JSON result with a personality based on the image.  We
    // use SGLang's regex constrained decoding but other methods work just
    // fine.
    //
    // Note: We'd use `render` here but it doesn't allow for additional
    // arguments, so we do it the painful way.
    const result = await openai.chat.completions.create({
      model: "default",
      max_tokens: 512,
      messages: [
        {
          role: "system",
          content: "You are a creative AI writing assistant",
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: image,
              },
            },
            {
              type: "text",
              text: "The image is about a unique and interesting character.  Fill in the following JSON about the character",
            },
          ],
        },
      ],
      // My god what is this.  Why no pydantic.
      regex:
        '\\{\\n "name": "[\\w\\d\\s]{8,24}",\\n "hobbies": "[\\w\\d\\s,]{24,48}",\\n "background": "[\\w\\d\\s]{48,128}\\.",\\n "personality": "[\\w\\d\\s]{48,128}\\.",\\n "favorite_pun": "[\\w\\d\\s]{48,128}\\."\\n \\}',
    });
    const profile = JSON.parse(result.choices[0].message.content);

    // Now we can fully render the character details.  Just show a few for
    // kicks.
    uiStream.done(
      <div className="inline-flex gap-1">
        <figure className="h-[256px]  w-[256px]">
          <img src={image} />
        </figure>
        <div>
          <table>
            <tbody>
              <tr>
                <td>Name</td>
                <td>{profile.name}</td>
              </tr>
              <tr>
                <td>Hobbies</td>
                <td>{profile.hobbies}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );

    // Let the client side know we're all done and it can move onto the next
    // stage.
    aiState.done(({ context, messages }) => ({
      messages,
      context: {
        ...context,
        name: profile.name,
        hobbies: profile.hobbies,
        ready: true,
      },
    }));
  })();

  return {
    id: Date.now(),
    display: uiStream.value,
  };
}

/**
 * Conducts a conversation between the current state's character and the user.
 */
async function submitUserMessage(content: string) {
  "use server";

  // Lets us fetch relevant AI state.
  const aiState = getMutableAIState<typeof AI>();

  // Record the user input.
  aiState.update(({ messages, context }) => ({
    context,
    messages: [
      ...messages,
      {
        role: "user",
        content,
      },
    ],
  }));

  // Show something meaningful.
  const uiStream = createStreamableUI(
    <div className="inline-flex gap-1">...</div>
  );

  (async () => {
    // Get the context (to guide the response style) and message history.
    const { context, messages } = aiState.get();
    // Get a new response given the personality and the message history so far.
    // Should probably clip the message history if we care about context
    // limits.
    const result = await openai.chat.completions.create({
      model: "default",
      max_tokens: 512,
      messages: [
        {
          role: "system",
          content: `You are a chatbot named ${context.name}.  Your favorite hobbies are ${context.hobbies}.  You always respond with this personality.`,
        },
        ...messages,
      ],
    });

    // Let the client side know we got a response.
    const response = result.choices[0].message.content;
    aiState.done(({ messages, context }) => ({
      context,
      messages: [
        ...messages,
        {
          role: "assistant",
          content: response,
        },
      ],
    }));
    uiStream.done(<div className="inline-flex gap-1">{response}</div>);
  })();

  return {
    id: Date.now(),
    display: uiStream.value,
  };
}

/**
 * Mimic OpenAI's message format
 */
interface AIStateMessage {
  role: "user" | "assistant" | "system" | "function";
  content: string;
}

/**
 * A minimal struct for our character profile.
 */
interface AIContext {
  /**
   * Unique ID.
   */
  itemId?: string;
  /**
   * Image URL
   */
  image?: string;
  /**
   * A cute name
   */
  name?: string;
  /**
   * Some hobbies
   */
  hobbies?: string;
  /**
   * State variable, true when all above is ready.
   */
  ready?: boolean;
}

/**
 * State for multi-faced interactions.
 */
interface AIState {
  /**
   * Conversation between the character and the user.
   */
  messages: AIStateMessage[];
  /**
   * Character profile
   */
  context: AIContext;
}

/**
 * Our UI state for messages.
 */
interface UIStateMessage {
  id: number;
  display: React.ReactNode;
}

/**
 * Our UI state for character resuts.  Basically the same but could be
 * different.
 */
interface UIStateResult {
  id: number;
  display: React.ReactNode;
}

/**
 * Our UI State
 */
interface UIState {
  /**
   * Messages for creating the character.
   */
  messages: UIStateMessage[];
  /**
   * Messages in conversation with the character.
   */
  conversation: UIStateMessage[];
  /**
   * Attempts for creating the character.
   */
  results: UIStateResult[];
}

const initialAIState: AIState = { messages: [], context: {} };

const initialUIState: UIState = {
  messages: [],
  results: [],
  conversation: [],
};

export const AI = createAI({
  actions: {
    generateDebater,
    submitUserMessage,
  },
  initialAIState,
  initialUIState,
});
