import type { MenuController } from '../application/menu-controller';

// Arrow keys drive the menu; Enter/Space confirm; Escape cancels a pending payment.
// Only attached while the menu/payment overlay is up — once playing, the flipper
// keyboard forwarder takes over the arrow keys.
export function attachMenuInput(controller: MenuController): () => void {
  const onKeyDown = (e: KeyboardEvent): void => {
    switch (e.code) {
      case 'ArrowLeft':
        e.preventDefault();
        controller.move(-1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        controller.move(1);
        break;
      case 'Enter':
      case 'Space':
        e.preventDefault();
        controller.confirm();
        break;
      case 'Escape':
        e.preventDefault();
        controller.cancel();
        break;
      default:
        break;
    }
  };

  document.addEventListener('keydown', onKeyDown);
  return () => {
    document.removeEventListener('keydown', onKeyDown);
  };
}
