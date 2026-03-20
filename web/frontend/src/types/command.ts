export interface Command {
  id: string;
  label: string;
  shortcut?: string;
  category: string;
  action: () => void;
}

class CommandRegistryImpl {
  private _commands: Command[] = [];

  get commands(): Command[] {
    return this._commands;
  }

  register(command: Command): void {
    // Replace if same id already exists, otherwise append
    const idx = this._commands.findIndex((c) => c.id === command.id);
    if (idx >= 0) {
      this._commands[idx] = command;
    } else {
      this._commands.push(command);
    }
  }

  unregister(id: string): void {
    this._commands = this._commands.filter((c) => c.id !== id);
  }

  search(query: string): Command[] {
    if (!query) return this._commands;
    const lower = query.toLowerCase();
    return this._commands.filter((c) => c.label.toLowerCase().includes(lower));
  }
}

export const commandRegistry = new CommandRegistryImpl();
