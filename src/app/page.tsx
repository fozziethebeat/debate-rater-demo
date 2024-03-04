"use client";

import { useAIState, useUIState, useActions } from "ai/rsc";
import { useState } from "react";

import type { AI } from "@/app/action";

/**
 * This page has two stages of AI interaction:
 * 1) Create an AI personality guided by an image.
 * 2) Chat with the personality.
 *
 * We do this by interfacing with a unified Vercel AI State that stores
 * everything that matters.
 */
export default function Page() {
  /**
   * Handles form input to create the personality.
   */
  const [inputValue, setInputValue] = useState("");
  /**
   * Our rendered and streaming UI Elements for the personality.  Has a
   * complicated structure.
   */
  const [uiState, setUIState] = useUIState<typeof AI>();
  /**
   * Our AI State variable.  Tells us when the character is ready.
   */
  const [aiState, setAIState] = useAIState<typeof AI>();
  /**
   * The AI method we'll be using to generate a character.
   */
  const { generateDebater } = useActions<typeof AI>();

  return (
    <div>
      {
        // View the message history for creating the character.
        uiState.messages.map((message) => (
          <div key={message.id}>{message.display}</div>
        ))
      }

      <form
        onSubmit={async (e) => {
          e.preventDefault();

          // Update only the UI state for creating the character.  Be careful
          // not to trash anything else.
          setUIState((currentState) => ({
            ...currentState,
            messages: [
              ...currentState.messages,
              {
                id: Date.now(),
                display: <div>{inputValue}</div>,
              },
            ],
          }));

          // Try to create a character.
          const responseMessage = await generateDebater(inputValue);
          // Again, update only the UI state for creating the character.  Be
          // careful not to trash anything else.
          setUIState((currentState) => ({
            ...currentState,
            results: [...currentState.results, responseMessage],
          }));

          setInputValue("");
        }}
      >
        <input
          placeholder="Send a message..."
          value={inputValue}
          onChange={(event) => {
            setInputValue(event.target.value);
          }}
        />
      </form>

      {uiState.results.length > 0 && (
        // We can now show the character as it's being created.
        <div>{uiState.results[uiState.results.length - 1].display}</div>
      )}
      {aiState.context.ready && (
        // We got a full character.  Let's chat with it.
        <div>
          <Chat />
        </div>
      )}
    </div>
  );
}

/**
 * Second stage component for chatting directly with a generated character.
 */
function Chat() {
  /**
   * Handles form state.
   */
  const [inputValue, setInputValue] = useState("");
  /**
   * Handles our convesation history.
   */
  const [uiState, setUIState] = useUIState<typeof AI>();
  /**
   * Lets us chat.
   */
  const { submitUserMessage } = useActions<typeof AI>();

  return (
    <div>
      {uiState.conversation.map((message) => (
        // Actual conversation history with back and forth.
        <div key={message.id}>{message.display}</div>
      ))}

      <form
        onSubmit={async (e) => {
          e.preventDefault();

          // Update only the conversation fields.
          setUIState((currentState) => ({
            ...currentState,
            conversation: [
              ...currentState.conversation,
              {
                id: Date.now(),
                display: <div>{inputValue}</div>,
              },
            ],
          }));

          // Request a streaming chat response.
          const responseMessage = await submitUserMessage(inputValue);
          // Update only the conversation fields.
          setUIState((currentState) => ({
            ...currentState,
            conversation: [...currentState.conversation, responseMessage],
          }));
          setInputValue("");
        }}
      >
        <input
          placeholder="Send a message..."
          value={inputValue}
          onChange={(event) => {
            setInputValue(event.target.value);
          }}
        />
      </form>
    </div>
  );
}
