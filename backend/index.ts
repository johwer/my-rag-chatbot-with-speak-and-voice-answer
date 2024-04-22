import {
  Request,
  Response,
  Application,
  Express,
} from "express-serve-static-core";
import express from "express";
import { MongoClient } from "mongodb"; // Import MongoDB client
import { helpers, PredictionServiceClient } from "@google-cloud/aiplatform";
import configJson from "./config.json";
import { Config, IPredictRequest, IPredictResponse, Value } from "./types";
import cors from "cors";

// Ensure the imported config matches the Config interface
const config: Config = configJson as Config;

const mongoUri: string = config.mongoDB.mongoUri;
const client: MongoClient = new MongoClient(mongoUri);

const app: Application = express() as Express;
const dbName: string = config.mongoDB.dbName;
const collectionName: string = config.mongoDB.collectionName;

const clientOptions = {
  apiEndpoint: config.googleCloud.apiEndpoint,
};

const project: string = config.googleCloud.project;
const location: string = config.googleCloud.location;
const publisher: string = config.googleCloud.publisher;
const model: string = config.googleCloud.model;

const predictionServiceClient = new PredictionServiceClient(clientOptions);

let history: Array<{ author: string; content: string }> = [];
let lastRag: boolean = false;

function extractFloatsFromJson(
  jsonData: IPredictResponse["predictions"]
): number[] {
  let floats: number[] = [];
  jsonData?.forEach((item) => {
    const values =
      item?.structValue?.fields?.embeddings?.structValue?.fields?.values
        ?.listValue;
    values?.values?.forEach((valueItem: Value) => {
      if (valueItem?.kind === "numberValue") {
        floats.push(valueItem?.numberValue ?? 0);
      }
    });
  });
  return floats;
}

async function getEmbeddings(text: string): Promise<number[]> {
  const embeddingModel: string = config.googleCloud.embeddingModel;
  const endpoint: string = `projects/${project}/locations/${location}/publishers/${publisher}/models/${embeddingModel}`;
  const instance = { content: text };
  const instanceValue = helpers.toValue(instance);
  const instances = [instanceValue];

  const parameter = {
    temperature: 0,
    maxOutputTokens: 256,
    topP: 0,
    topK: 1,
  };
  const parameters = helpers.toValue(parameter);

  const request = {
    endpoint,
    instances,
    parameters,
  };

  try {
    const [{ predictions }] = await predictionServiceClient.predict(
      request as IPredictRequest
    );
    if (predictions) {
      return extractFloatsFromJson(predictions); // Fix: Cast predictions to any[]
    } else {
      throw new Error("No predictions found in the response");
    }
  } catch (error) {
    console.error("Failed to predict:", error);
    throw error; // Rethrow the error to handle it in the calling function
  }
}

app.use(express.json());
app.use(cors());

app.get("/", (req: Request, res: Response) => {
  res.send("RAG Chatbot Backend is running!");
});

app.post("/embedding", async (req: Request, res: Response) => {
  const text = req.body.text;
  try {
    const embeddings = await getEmbeddings(text);
    res.json({ embeddings });
  } catch (error) {
    console.error("Error getting embeddings:", error);
    res.status(500).json({ message: "Error processing your request" });
  }
});

app.post("/chat", async (req: Request, res: Response) => {
  const userMessage: string = req.body.message;
  const rag: boolean = req.body.rag;

  if (lastRag !== rag) {
    history = [];
    lastRag = rag;
  }

  history.push({ author: "user", content: userMessage });

  try {
    let prompt;
    if (rag) {
      const embeddings = await getEmbeddings(userMessage);
      const db = client.db(dbName);
      const collection = db.collection(collectionName);
      const pipeline = [
        {
          $vectorSearch: {
            index: "vector_index",
            path: "embedding",
            queryVector: embeddings,
            numCandidates: 200,
            limit: 1,
          },
        },
      ];

      const aggregationResponse = await collection
        .aggregate(pipeline)
        .toArray();
      if (aggregationResponse.length > 0) {
        const { pdfFileName, sentence, pageNumber } = aggregationResponse[0];
        const mongoContext = `Answer the user based on the relevant context, always tell the user the name of the pdf file and the page number as part of your answer: "${sentence}" from ${pdfFileName}, page ${pageNumber}.`;
        prompt = { context: mongoContext, examples: [], messages: history };
      } else {
        console.error("No results from vector search");
        res.status(500).json({ message: "No results from vector search" });
        return;
      }
    } else {
      prompt = {
        context: `You are a helpful chatbot, you are not allowed to lie or make stuff up. RAG is off. If you can't find the information the user is looking for say "I don't know" `,
        examples: [],
        messages: history,
      };
    }

    const instanceValue = helpers.toValue(prompt);
    const instances = [instanceValue];
    const parameters = helpers.toValue({
      temperature: 0.2,
      maxOutputTokens: 450,
      topP: 0.95,
      topK: 40,
    });
    const endpoint = `projects/${project}/locations/${location}/publishers/${publisher}/models/${model}`;
    const request = { endpoint, instances, parameters };
    const [{ predictions }] = await predictionServiceClient.predict(
      request as IPredictRequest
    );

    if (predictions && predictions.length > 0) {
      const botResponseObj = predictions[0];
      const candidates =
        botResponseObj?.structValue?.fields?.candidates?.listValue?.values;
      const botTextResponse =
        candidates?.[0]?.structValue?.fields?.content?.stringValue;

      if (!botTextResponse) {
        console.error("No bot text response found");
        res.status(500).json({ message: "No bot text response found" });
        return;
      }
      history.push({ author: "system", content: botTextResponse });

      res.json({ message: botTextResponse });
    } else {
      console.error("No predictions received");
      res.status(500).json({ message: "No predictions received" });
    }
  } catch (error) {
    console.error("Error processing chat message:", error);
    res.status(500).json({ message: "Error processing your message" });
  }
});

async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("Connected successfully to MongoDB");
  } catch (error) {
    console.error("Could not connect to MongoDB:", error);
    process.exit(1);
  }
}

connectToMongoDB().then(() => {
  app.listen(config.port, () => {
    console.log(`Server is running on port ${config.port}`);
  });
});

process.on("SIGINT", async () => {
  await client.close();
  console.log("MongoDB connection closed");
  process.exit(0);
});
