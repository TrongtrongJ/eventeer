import { type INestApplication } from "@nestjs/common";
import { OpenAPIGenerator, populateRouterContractOpenAPIPaths } from "@orpc/openapi";
import { apiReference } from "@scalar/nestjs-api-reference";
import { baseContract } from "@packages/contract";
export async function bootstrapAppWithOpenAPI(app: INestApplication) {
    const generator = new OpenAPIGenerator();
    const rootContract = populateRouterContractOpenAPIPaths(baseContract);

    const document = await generator.generate(rootContract, {
        base: {
            info: { title: "Eventeer API", version: "1.0.0" },
        },
    });

    app.use(
        "/docs",
        apiReference({
            spec: {
                content: document, // Pass the generated JSON directly
            },
            theme: "bluePlanet",
        }),
    );
}
