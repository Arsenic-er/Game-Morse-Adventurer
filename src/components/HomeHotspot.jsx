// Traced against home-room-overlay.png, using a 1280 px wide reference.
// Bounds and silhouettes share the room's cover-scaled coordinate system.
const ROOM_WIDTH = 1280;
const ROOM_HEIGHT = ROOM_WIDTH * 941 / 1672;
const OBJECTS = {
  warehouse: {
    bounds: [0, 139, 254, 379],
    path: "M 1 145 L 219 143 L 231 147 L 251 154 L 250 409 L 236 419 L 230 428 L 229 496 L 219 507 L 202 514 L 194 506 L 123 487 L 1 504 Z",
  },
  station: {
    bounds: [453, 442, 334, 204],
    path: "M 458 634 L 461 606 L 465 594 L 476 462 L 476 454 Q 477 446 485 446 Q 492 446 493 454 L 492 460 L 747 460 L 748 451 Q 751 444 758 447 Q 765 448 765 456 L 763 467 L 777 588 L 780 595 L 785 634 L 779 642 L 462 642 Z",
  },
  store: {
    bounds: [827, 324, 309, 264],
    path: "M 830 528 L 900 482 L 903 447 L 912 337 L 915 328 L 921 327 L 1126 330 L 1132 336 L 1126 476 L 1124 506 L 1119 519 L 1074 579 L 1064 584 L 834 545 L 830 541 Z",
  },
  practice: {
    bounds: [0, 484, 218, 161],
    path: "M 1 506 L 120 487 L 194 513 L 194 539 L 205 545 L 206 573 L 215 577 L 216 597 L 20 642 L 1 632 L 1 606 L 7 603 L 1 598 L 1 571 L 7 568 L 1 563 Z",
  },
  log: {
    bounds: [100, 611, 210, 110],
    path: "M 104 642 L 116 635 L 218 614 L 228 618 L 230 626 L 306 700 L 307 710 L 278 720 L 145 720 L 105 666 L 102 652 Z",
  },
  achievements: {
    bounds: [863, 598, 234, 123],
    path: "M 866 671 L 914 601 L 1079 622 L 1079 637 L 1094 641 L 1075 714 L 1084 720 L 1044 720 L 876 681 L 880 675 Z",
  },
};

export function HomeHotspot({ target, children, ...props }) {
  const { bounds: [x, y, width, height], path } = OBJECTS[target];
  return (
    <button
      {...props}
      className={`home-hotspot hotspot-${target}`}
      style={{ left: `${x / ROOM_WIDTH * 100}%`, top: `${y / ROOM_HEIGHT * 100}%`, width: `${width / ROOM_WIDTH * 100}%`, height: `${height / ROOM_HEIGHT * 100}%` }}
    >
      <svg className="home-hotspot-outline" viewBox={`${x} ${y} ${width} ${height}`} aria-hidden="true" focusable="false">
        <path className="home-hotspot-halo" d={path} vectorEffect="non-scaling-stroke" />
        <path className="home-hotspot-edge" d={path} vectorEffect="non-scaling-stroke" />
      </svg>
      {children}
    </button>
  );
}
