import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { checkDatabase } from "../services/health.service";

export async function dbHealth(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const result = await checkDatabase();
    if (!result.ok) {
        context.error(`Database health check failed: ${result.error}`);
    }

    return { status: result.ok ? 200 : 503, jsonBody: result };
};

// Function-level auth: in Azure, callers need the function key. Locally keys are not enforced.
app.http('dbHealth', {
    methods: ['GET'],
    authLevel: 'function',
    route: 'health/db',
    handler: dbHealth
});
