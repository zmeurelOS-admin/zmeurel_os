declare module 'npm:@supabase/supabase-js@2' {
  type SupabaseDenoError = { message: string } | null

  type SupabaseDenoQueryBuilder<T = Record<string, unknown>> = {
    data: T[] | null
    error: SupabaseDenoError
    eq(column: string, value: unknown): SupabaseDenoQueryBuilder<T>
    maybeSingle(): Promise<{ data: T | null; error: SupabaseDenoError }>
    limit(count: number): SupabaseDenoQueryBuilder<T>
    order(column: string, options?: { ascending?: boolean }): SupabaseDenoQueryBuilder<T>
    gt(column: string, value: string): SupabaseDenoQueryBuilder<T>
    not(column: string, operator: string, value: null): SupabaseDenoQueryBuilder<T>
  }

  export function createClient(...args: unknown[]): {
    auth: {
      getUser(accessToken: string): Promise<{
        data: { user: { id: string } | null }
        error: { message: string } | null
      }>
    }
    from(table: string): {
      select(columns: string): SupabaseDenoQueryBuilder<Record<string, unknown>>
      insert(values: Record<string, unknown>): {
        select(columns: string): {
          limit(count: number): Promise<{ data: unknown[] | null; error: SupabaseDenoError }>
        }
      }
    }
  }
}

declare module 'https://deno.land/std@0.224.0/http/server.ts' {
  export function serve(handler: (request: Request) => Response | Promise<Response>): void
}

declare const Deno: {
  env: {
    get(name: string): string | undefined
  }
}
