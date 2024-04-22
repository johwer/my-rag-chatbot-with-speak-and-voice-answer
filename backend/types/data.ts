import { protos } from "@google-cloud/aiplatform";

export type IPredictRequest = {
  /** PredictRequest endpoint */
  endpoint?: string | null;

  /** PredictRequest instances */
  instances?: protos.google.protobuf.IValue[] | null;

  /** PredictRequest parameters */
  parameters?: protos.google.protobuf.IValue | null;
};
export type IPredictResponse = {
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
};

export type Value = {
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
};
