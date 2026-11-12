import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
// Resolve from the repository rather than the caller's working directory.
dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});
