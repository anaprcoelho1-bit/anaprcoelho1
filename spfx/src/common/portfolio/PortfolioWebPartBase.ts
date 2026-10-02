import * as React from 'react';
import { SPPermission } from '@microsoft/sp-page-context';
import { type IPropertyPaneGroup, PropertyPaneTextField } from '@microsoft/sp-property-pane';
import { BaseSectionWebPart } from '../BaseSectionWebPart';
import { DEFAULT_SOURCE, IPortfolioSource } from './fields';
import { IPortfolioDataProps } from './usePortfolio';

export interface IPortfolioWebPartSettings extends IPortfolioSource {
  title: string;
  subtitle: string;
}

export type IPortfolioComponentProps<TSettings extends IPortfolioWebPartSettings> = TSettings & IPortfolioDataProps;

/** Base das web parts operacionais: fonte de dados comum e permissão de edição do usuário. */
export abstract class PortfolioWebPartBase<TSettings extends IPortfolioWebPartSettings> extends BaseSectionWebPart<TSettings> {
  protected abstract get component(): React.FC<IPortfolioComponentProps<TSettings>>;

  protected sourceDefaults(): IPortfolioSource {
    return { ...DEFAULT_SOURCE };
  }

  protected renderSection(properties: TSettings): React.ReactElement {
    const source: IPortfolioSource = {
      parametersUrl: properties.parametersUrl,
      initiativesList: properties.initiativesList,
      decisionsList: properties.decisionsList,
      capacityList: properties.capacityList,
      scoresList: properties.scoresList,
      cycle: properties.cycle
    };
    const props: IPortfolioComponentProps<TSettings> = {
      ...properties,
      spHttpClient: this.context.spHttpClient,
      webUrl: this.context.pageContext.web.absoluteUrl,
      source,
      canEdit: this.context.pageContext.web.permissions.hasPermission(SPPermission.editListItems)
    };
    return React.createElement(this.component, props);
  }

  protected textGroup(): IPropertyPaneGroup {
    return {
      groupName: 'Textos',
      groupFields: [
        PropertyPaneTextField('title', { label: 'Título' }),
        PropertyPaneTextField('subtitle', { label: 'Descrição', multiline: true })
      ]
    };
  }

  protected sourceGroup(): IPropertyPaneGroup {
    return {
      groupName: 'Fonte de dados',
      isCollapsed: true,
      groupFields: [
        PropertyPaneTextField('parametersUrl', {
          label: 'Arquivo de parâmetros da metodologia',
          description: 'metodologia.json publicado pelo script (relativo ao site). Vazio usa os pesos e faixas do documento.'
        }),
        PropertyPaneTextField('initiativesList', { label: 'Lista de iniciativas' }),
        PropertyPaneTextField('decisionsList', { label: 'Lista do Registro de Decisões' }),
        PropertyPaneTextField('capacityList', { label: 'Lista do Mapa de Capacidade' }),
        PropertyPaneTextField('scoresList', { label: 'Lista de pontuações do comitê', description: 'Opcional: notas individuais para apurar divergências.' }),
        PropertyPaneTextField('cycle', { label: 'Ciclo de capacidade', description: 'Ex.: 2026-T4. Vazio usa o trimestre atual.' })
      ]
    };
  }
}
