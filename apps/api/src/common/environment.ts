import { z } from 'zod';
const httpUrl = z
  .string()
  .url()
  .refine((value) => {
    const url = URL.parse(value);
    return (
      url !== null &&
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      !value.endsWith('/')
    );
  });
const schema = z
  .object({
    KEYCLOAK_PUBLIC_URL: httpUrl,
    KEYCLOAK_INTERNAL_URL: httpUrl,
    KEYCLOAK_ISSUER: httpUrl,
    KEYCLOAK_JWKS_URL: httpUrl,
    KEYCLOAK_REALM: z.string().regex(/^[a-zA-Z0-9_-]+$/),
    KEYCLOAK_API_AUDIENCE: z.string().min(1),
    KEYCLOAK_ADMIN_CLIENT_ID: z.string().min(1),
    KEYCLOAK_ADMIN_CLIENT_SECRET: z
      .string()
      .min(32)
      .refine((value) => !value.startsWith('replace-')),

    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z
      .string()
      .url()
      .refine((value) => /^postgres(ql)?:\/\//.test(value)),
    CORS_ORIGINS: z
      .string()
      .min(1)
      .transform((value) => value.split(',').map((origin) => origin.trim()))
      .pipe(
        z
          .array(
            z
              .string()
              .url()
              .refine((value) => {
                const url = URL.parse(value);
                return (
                  url !== null &&
                  ['http:', 'https:'].includes(url.protocol) &&
                  url.origin === value
                );
              }),
          )
          .min(1),
      ),
  })
  .superRefine((env, context) => {
    if (
      env.KEYCLOAK_ISSUER !==
      `${env.KEYCLOAK_PUBLIC_URL}/realms/${env.KEYCLOAK_REALM}`
    )
      context.addIssue({
        code: 'custom',
        path: ['KEYCLOAK_ISSUER'],
        message: 'Issuer must match configured public realm',
      });
    if (env.NODE_ENV === 'production')
      for (const key of [
        'KEYCLOAK_PUBLIC_URL',
        'KEYCLOAK_INTERNAL_URL',
        'KEYCLOAK_JWKS_URL',
      ] as const)
        if (!env[key].startsWith('https://'))
          context.addIssue({
            code: 'custom',
            path: [key],
            message: 'HTTPS required',
          });
  });
export function validateEnvironment(config: Record<string, unknown>) {
  const result = schema.safeParse(config);
  if (!result.success) {
    throw new Error(
      `Invalid environment variables: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`,
    );
  }
  return result.data;
}
