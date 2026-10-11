/** Returns the trimmed string, or undefined if it is missing or blank. */
export function nonEmpty(value: string | null | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}
