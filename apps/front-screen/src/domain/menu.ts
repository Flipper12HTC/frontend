// Pure model for the start menu: pick how you want to play.
export type GameMode = 'user' | 'tournament';

// "user" mode pays a flat launch fee to start a ranked game.
export const LAUNCH_FEE_SOL = 0.8;

export interface MenuModel {
  options: GameMode[];
  selectedIndex: number;
}

export function createMenu(): MenuModel {
  return { options: ['user', 'tournament'], selectedIndex: 0 };
}

// Arrow navigation wraps around the options.
export function moveSelection(menu: MenuModel, dir: -1 | 1): MenuModel {
  const n = menu.options.length;
  const selectedIndex = (menu.selectedIndex + dir + n) % n;
  return { ...menu, selectedIndex };
}

export function selectedMode(menu: MenuModel): GameMode {
  return menu.options[menu.selectedIndex] ?? 'user';
}
