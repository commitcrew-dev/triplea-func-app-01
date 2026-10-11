import { DEFAULT_GREETING_NAME } from "../constants";
import { nonEmpty } from "../utils";

export function buildGreeting(name?: string | null): string {
    return `Hello, ${nonEmpty(name) ?? DEFAULT_GREETING_NAME}!`;
}
