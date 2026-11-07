/** A mapping problem: the API's data does not fit the model, or the vocabulary tables do not cover it. */
export class MapError extends Error {
  readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "MapError";
    this.details = details;
  }
}
