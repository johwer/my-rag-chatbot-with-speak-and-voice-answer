// TypeScript type for the config to better handle property accessing
export type Config = {
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
};
