import React from 'react';

// Helper para converter estilos React Native em estilos inline CSS para React Web
function flattenStyles(style: any): React.CSSProperties {
  if (!style) return {};
  if (Array.isArray(style)) {
    return style.reduce((acc, s) => ({ ...acc, ...flattenStyles(s) }), {});
  }
  
  const css: Record<string, any> = { ...style };

  // paddingVertical / paddingHorizontal
  if (css.paddingVertical !== undefined) {
    css.paddingTop = css.paddingTop ?? css.paddingVertical;
    css.paddingBottom = css.paddingBottom ?? css.paddingVertical;
    delete css.paddingVertical;
  }
  if (css.paddingHorizontal !== undefined) {
    css.paddingLeft = css.paddingLeft ?? css.paddingHorizontal;
    css.paddingRight = css.paddingRight ?? css.paddingHorizontal;
    delete css.paddingHorizontal;
  }

  // marginVertical / marginHorizontal
  if (css.marginVertical !== undefined) {
    css.marginTop = css.marginTop ?? css.marginVertical;
    css.marginBottom = css.marginBottom ?? css.marginVertical;
    delete css.marginVertical;
  }
  if (css.marginHorizontal !== undefined) {
    css.marginLeft = css.marginLeft ?? css.marginHorizontal;
    css.marginRight = css.marginRight ?? css.marginHorizontal;
    delete css.marginHorizontal;
  }

  // transform: [{ rotate: '-15deg' }]
  if (Array.isArray(css.transform)) {
    css.transform = css.transform
      .map((t: any) => {
        if (typeof t === 'string') return t;
        const key = Object.keys(t)[0];
        return `${key}(${t[key]})`;
      })
      .join(' ');
  }

  // shadow
  if (css.shadowColor || css.shadowOpacity || css.shadowRadius) {
    const color = css.shadowColor || 'rgba(0,0,0,0.1)';
    const radius = css.shadowRadius ?? 4;
    css.boxShadow = `0 4px ${radius}px ${color}`;
    delete css.shadowColor;
    delete css.shadowOpacity;
    delete css.shadowRadius;
  }

  return css;
}

export const View = React.forwardRef<HTMLDivElement, any>(({ style, children, ...props }, ref) => {
  const inline = flattenStyles(style);
  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', boxSizing: 'border-box', ...inline }} {...props}>
      {children}
    </div>
  );
});

export const Text = React.forwardRef<HTMLSpanElement, any>(({ style, children, ...props }, ref) => {
  const inline = flattenStyles(style);
  return (
    <span ref={ref} style={{ boxSizing: 'border-box', ...inline }} {...props}>
      {children}
    </span>
  );
});

export const TouchableOpacity = React.forwardRef<HTMLButtonElement, any>(({ style, onPress, onClick, children, ...props }, ref) => {
  const inline = flattenStyles(style);
  return (
    <button
      ref={ref}
      type="button"
      onClick={onPress || onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        cursor: 'pointer',
        background: 'transparent',
        border: 'none',
        textAlign: 'inherit',
        font: 'inherit',
        padding: 0,
        ...inline,
      }}
      {...props}
    >
      {children}
    </button>
  );
});

export const ScrollView = React.forwardRef<HTMLDivElement, any>(({ style, children, ...props }, ref) => {
  const inline = flattenStyles(style);
  return (
    <div
      ref={ref}
      style={{
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        overflowY: 'auto',
        ...inline,
      }}
      {...props}
    >
      {children}
    </div>
  );
});

export const SafeAreaView = React.forwardRef<HTMLDivElement, any>(({ style, children, ...props }, ref) => {
  const inline = flattenStyles(style);
  return (
    <div
      ref={ref}
      style={{
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        minHeight: '100vh',
        width: '100%',
        ...inline,
      }}
      {...props}
    >
      {children}
    </div>
  );
});

export const StyleSheet = {
  create: <T extends Record<string, any>>(styles: T): T => styles,
};

export default {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StyleSheet,
};
