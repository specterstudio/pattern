export interface IconSvgDefinition {
  readonly body: string;
  readonly viewBox: string;
}

export type IconSvgMap = Readonly<Record<string, IconSvgDefinition>>;
