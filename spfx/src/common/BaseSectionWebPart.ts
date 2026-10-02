import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Guid, Version } from '@microsoft/sp-core-library';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';

/**
 * Base comum das web parts da página Gestão de Portfólio.
 *
 * - Preenche as propriedades ausentes com os valores padrão (conteúdo do layout aprovado),
 *   para que a web part já apareça completa ao ser adicionada e o painel de propriedades
 *   mostre o texto atual em vez de campos vazios.
 * - Garante um uniqueId em cada item das listas editáveis (exigido pelo editor de coleções,
 *   inclusive para itens vindos do script de implantação).
 * - Renderiza o componente React da seção e o desmonta ao descartar a web part.
 */
export abstract class BaseSectionWebPart<TProps extends object> extends BaseClientSideWebPart<TProps> {
  protected abstract get defaultProperties(): TProps;

  protected abstract renderSection(properties: TProps): React.ReactElement;

  protected onInit(): Promise<void> {
    applyDefaults(this.properties, this.defaultProperties);
    ensureItemIds(this.properties);
    return super.onInit();
  }

  public render(): void {
    ReactDom.render(this.renderSection({ ...this.properties }), this.domElement);
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }
}

export function applyDefaults<T extends object>(target: T, defaults: T): void {
  (Object.keys(defaults) as (keyof T)[]).forEach((key) => {
    if (target[key] === undefined || target[key] === null) {
      target[key] = JSON.parse(JSON.stringify(defaults[key]));
    }
  });
}

export function ensureItemIds(target: object): void {
  Object.keys(target).forEach((key) => {
    const value = (target as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      value.forEach((item: unknown) => {
        if (item && typeof item === 'object' && !(item as { uniqueId?: string }).uniqueId) {
          (item as { uniqueId?: string }).uniqueId = Guid.newGuid().toString();
        }
      });
    }
  });
}
