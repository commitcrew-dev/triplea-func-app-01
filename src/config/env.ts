// Single place to read app settings. Locally they come from local.settings.json,
// in Azure from the function app's Application settings.

export function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required app setting: ${name}`);
    }
    return value;
}

export function optionalEnv(name: string, fallback?: string): string | undefined {
    return process.env[name] || fallback;
}
