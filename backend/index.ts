//import express, { Express, Request, Application } from 'express';
import {
  Request,
  Response,
  Application,
  Express,
} from "express-serve-static-core";
import express from "express";
import { MongoClient } from "mongodb"; // Import MongoDB client
import {
  helpers,
  PredictionServiceClient,
  protos,
} from "@google-cloud/aiplatform";
//import { PredictionServiceClient, helpers } from aiplatform;
import configJson from "./config.json";
import cors from "cors";
//import protoLoader from "@grpc/proto-loader";
//import { google } from "googleapis"; // Import the googleapis module

//const { PredictionServiceClient } = aiplatform.v1;

// TypeScript type for the config to better handle property accessing
interface Config {
  mongoDB: {
    mongoUri: string;
    dbName: string;
    collectionName: string;
  };
  googleCloud: {
    apiEndpoint: string;
    project: string;
    location: string;
    publisher: string;
    model: string;
    embeddingModel: string;
  };
  port: number;
}

interface IPredictRequest {
  /** PredictRequest endpoint */
  endpoint?: string | null;

  /** PredictRequest instances */
  instances?: protos.google.protobuf.IValue[] | null;

  /** PredictRequest parameters */
  parameters?: protos.google.protobuf.IValue | null;
}

// /** Properties of a Value. */
// interface IValue {
//   /** Value nullValue */
//   nullValue?:
//     | protos.google.protobuf.NullValue
//     | keyof typeof protos.google.protobuf.NullValue
//     | null;

//   /** Value numberValue */
//   numberValue?: number | null;

//   /** Value stringValue */
//   stringValue?: string | null;

//   /** Value boolValue */
//   boolValue?: boolean | null;

//   /** Value structValue */
//   structValue?: protos.google.protobuf.IStruct | null;

//   /** Value listValue */
//   listValue?: protos.google.protobuf.IListValue | null;
// }

// type predtionsType = Promise<
//   [
//     protos.google.cloud.aiplatform.v1.IPredictResponse,
//     protos.google.cloud.aiplatform.v1.IPredictRequest | undefined,
//     {} | undefined
//   ]
// >;

interface IPredictResponse {
  /** PredictResponse predictions */
  predictions?: protos.google.protobuf.IValue[] | null;

  /** PredictResponse deployedModelId */
  deployedModelId?: string | null;

  /** PredictResponse model */
  model?: string | null;

  /** PredictResponse modelVersionId */
  modelVersionId?: string | null;

  /** PredictResponse modelDisplayName */
  modelDisplayName?: string | null;

  /** PredictResponse metadata */
  metadata?: protos.google.protobuf.IValue | null;
}

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

// /** Properties of a ListValue. */
// interface IListValue {
//   /** ListValue values */
//   values?: protos.google.protobuf.IValue[] | null;
// }

interface Value {
  nullValue?:
    | protos.google.protobuf.NullValue
    | keyof typeof protos.google.protobuf.NullValue
    | null;

  /** Value numberValue. */
  numberValue?: number | null;

  /** Value stringValue. */
  stringValue?: string | null;

  /** Value boolValue. */
  boolValue?: boolean | null;

  /** Value structValue. */
  structValue?: protos.google.protobuf.IStruct | null;

  /** Value listValue. */
  listValue?: protos.google.protobuf.IListValue | null;

  /** Value kind. */
  kind?:
    | "nullValue"
    | "numberValue"
    | "stringValue"
    | "boolValue"
    | "structValue"
    | "listValue";
}

/** Properties of a Struct. */
// interface IStruct {
//   /** Struct fields */
//   fields?: { [k: string]: protos.google.protobuf.IValue } | null;
// }

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

app.use(express.json()); // Replace "path/to/IPredictRequest" with the actual path to the IPredictRequest module
app.use(cors({ origin: true }));

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

    // const [response] = await predictionServiceClient.predict(request);
    const [{ predictions }] = await predictionServiceClient.predict(
      request as IPredictRequest
    );
    //const predictions = response?.predictions;

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
