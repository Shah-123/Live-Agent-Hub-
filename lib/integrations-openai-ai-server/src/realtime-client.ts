import WebSocket from "ws";


/**
 * OpenAI Realtime Relay Client
 * This class manages a single connection between the Backend and OpenAI.
 */
export class OpenAIRealtimeRelay {
  private openaiWs: WebSocket | null = null;
  private browserWs: WebSocket;
  private apiKey: string;
  private model: string;

  constructor(browserWs: WebSocket, apiKey: string, model: string = "gpt-4o-realtime-preview") {
    this.browserWs = browserWs;
    this.apiKey = apiKey;
    this.model = model;
  }

  /**
   * Initialize the connection to OpenAI
   */
  public async connect() {
    const url = `wss://api.openai.com/v1/realtime?model=${this.model}`;
    
    this.openaiWs = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "OpenAI-Beta": "realtime=v1",
      },
    });

    return new Promise<void>((resolve, reject) => {
      this.openaiWs!.on("open", () => {
        console.log("Connected to OpenAI Realtime API");
        resolve();
      });


      this.openaiWs!.on("message", (data: WebSocket.Data) => {
        // Forward everything from OpenAI to the Browser
        if (this.browserWs.readyState === WebSocket.OPEN) {
          this.browserWs.send(data.toString());
        }
      });

      this.openaiWs!.on("error", (err: Error) => {
        console.error("OpenAI Realtime WebSocket Error:", err);
        reject(err);
      });

      this.openaiWs!.on("close", () => {
        console.log("OpenAI Realtime connection closed");
        this.browserWs.close();
      });


      // Browser -> OpenAI forwarding
      this.browserWs.on("message", (data: WebSocket.Data) => {
        if (this.openaiWs?.readyState === WebSocket.OPEN) {
          const event = JSON.parse(data.toString());
          
          // Special handling for interruption if needed, 
          // but usually OpenAI's server-side VAD handles this if enabled.
          // We just forward the event for now.
          this.openaiWs.send(JSON.stringify(event));
        }
      });

      this.browserWs.on("close", () => {
        console.log("Browser WebSocket closed, closing OpenAI connection");
        this.openaiWs?.close();
      });
      
      this.browserWs.on("error", (err: Error) => {
        console.error("Browser WebSocket Error:", err);
        this.openaiWs?.close();
      });
    });
  }

  /**
   * Send a manual interruption to OpenAI if needed
   */
  public interrupt() {
    if (this.openaiWs?.readyState === WebSocket.OPEN) {
      this.openaiWs.send(JSON.stringify({ type: "response.cancel" }));
    }
  }
}
