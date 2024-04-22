// Importing necessary libraries and configuration
import fs from "fs";
import pdfParse from "pdf-parse";
import axios from "axios";
import { MongoClient } from "mongodb";
import config from "./config.json";

// Define the directory where PDF files are stored
const directoryPath = "./pdfs";
// Constructing the endpoint URL for embeddings from the configuration
const embeddingEndpoint = `http://localhost:${config.port}/embedding`;

// Creating a MongoDB client instance
const client = new MongoClient(config.mongoDB.mongoUri);
const dbName = config.mongoDB.dbName;
const collectionName = config.mongoDB.collectionName;

// Asynchronous function to read PDFs and generate embeddings
async function readPDFsAndEmbed(directoryPath: string): Promise<void> {
  try {
    await client.connect();
    console.log("Connected successfully to MongoDB server");
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    // Reading PDF files from the specified directory and filtering by ".pdf" extension
    const files = fs
      .readdirSync(directoryPath)
      .filter((file) => file.endsWith(".pdf"));

    // Processing each PDF file
    for (const file of files) {
      console.log(`Processing file: ${file}`);
      const filePath = `${directoryPath}/${file}`;
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);

      // Splitting the document text into sentences at each period followed by a space
      const sentences = data.text.split(". ");

      // Initialize pageNumber to 1 at the start
      let pageNumber = 1;

      // Iterating over sentences to send them for embedding generation
      for (const sentence of sentences) {
        // Making a POST request to the embedding service
        const response = await axios.post(embeddingEndpoint, {
          text: JSON.stringify(sentence),
        });

        // Extracting embeddings from the response
        const embedding = response.data.embeddings;

        // Inserting document details into MongoDB
        await collection.insertOne({
          pdfFileName: file, // The name of the PDF file being processed
          sentence, // The current sentence
          pageNumber, // The current page number
          embedding, // The embedding of the sentence
        });

        // Incrementing the page number if a page separator is found in the sentence
        if (/\n\n/.test(sentence)) {
          pageNumber++;
        }
      }
    }

    console.log("All PDFs processed and embeddings stored.");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    // Ensuring the MongoDB client is closed after operation completion
    await client.close();
  }
}

// Calling the function with the path to the PDF directory
readPDFsAndEmbed(directoryPath);
