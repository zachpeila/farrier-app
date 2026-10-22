import type { Database, Tables } from './database.types';

export type Profile = Tables<'profiles'>;
export type Horse = Tables<'horses'>;
export type Barn = Tables<'locations'>;
export type Client = Tables<'clients'>;
export type DueHorse = Tables<'due_horses'>;
export type ProviderRole = Database['public']['Enums']['provider_role'];
export type ShoeStatus = Database['public']['Enums']['shoe_status'];

/** Which side of the app someone is using. Stored in auth user metadata, not the schema. */
export type AppMode = 'farrier' | 'owner';
