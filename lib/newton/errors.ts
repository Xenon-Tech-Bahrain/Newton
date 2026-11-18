export class NewtonError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "newton_error") {
    super(message);
    this.name = "NewtonError";
    this.status = status;
    this.code = code;
  }
}

export class NewtonNotConfiguredError extends Error {
  constructor() {
    super("Aria is not configured for this deployment.");
    this.name = "NewtonNotConfiguredError";
  }
}
