import "@testing-library/jest-dom";

if (typeof window !== "undefined") {
  class DOMRectMock implements DOMRect {
    x: number;
    y: number;
    width: number;
    height: number;
    top: number;
    right: number;
    bottom: number;
    left: number;

    constructor(x = 0, y = 0, width = 0, height = 0) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.top = y;
      this.right = x + width;
      this.bottom = y + height;
      this.left = x;
    }

    toJSON() {
      return {
        x: this.x,
        y: this.y,
        width: this.width,
        height: this.height,
        top: this.top,
        right: this.right,
        bottom: this.bottom,
        left: this.left,
      };
    }

    static fromRect(rect: DOMRectInit = {}) {
      return new DOMRectMock(rect.x ?? 0, rect.y ?? 0, rect.width ?? 0, rect.height ?? 0);
    }
  }

  Object.defineProperty(window, "DOMRect", {
    writable: true,
    value: window.DOMRect ?? DOMRectMock,
  });

  if (typeof window.DOMRect.fromRect !== "function") {
    window.DOMRect.fromRect = DOMRectMock.fromRect;
  }

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });

  class ResizeObserverMock {
    observe() {}

    unobserve() {}

    disconnect() {}
  }

  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    value: ResizeObserverMock,
  });
}
