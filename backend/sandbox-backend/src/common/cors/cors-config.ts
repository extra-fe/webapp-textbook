export type CorsConfig =
  { enabled: false } | { enabled: true; origin: string[]; methods: string[] };

export function resolveCorsConfig(
  origin: string | undefined,
  methods: string | undefined,
): CorsConfig {
  if (!!origin !== !!methods) {
    throw new Error(
      'CORS_ORIGIN and CORS_METHODS must both be set or both be unset',
    );
  }
  if (origin && methods) {
    return {
      enabled: true,
      origin: origin.split(','),
      methods: methods.split(','),
    };
  }
  return { enabled: false };
}
