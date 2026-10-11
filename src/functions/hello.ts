import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { buildGreeting } from "../services/greeting.service";

export async function hello(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    const name = request.query.get('name') || await request.text();

    return { body: buildGreeting(name) };
};

app.http('hello', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: hello
});
