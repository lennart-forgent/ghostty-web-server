// Generic command-palette registry. Any island/file can register a provider
// that returns a list of commands; the palette aggregates and renders them.

export type Command = {
  id: string;
  label: string;
  group?: string;
  detail?: string;
  hint?: string;
  disabled?: boolean;
  onSelect: () => void | Promise<void>;
};

export type CommandProvider = () => Command[] | Promise<Command[]>;

const providers = new Set<CommandProvider>();

export function registerProvider(p: CommandProvider): () => void {
  providers.add(p);
  return () => providers.delete(p);
}

export async function loadCommands(): Promise<Command[]> {
  const lists = await Promise.all(
    [...providers].map(async (p) => {
      try {
        return await p();
      } catch {
        return [];
      }
    })
  );
  return lists.flat();
}
