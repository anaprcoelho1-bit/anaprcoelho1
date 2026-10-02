import * as React from 'react';
import {
  type IPropertyPaneConfiguration,
  PropertyPaneTextField
} from '@microsoft/sp-property-pane';
import {
  CustomCollectionFieldType,
  PropertyFieldCollectionData
} from '@pnp/spfx-property-controls/lib/PropertyFieldCollectionData';
import { BaseSectionWebPart } from '../../common/BaseSectionWebPart';
import PortfolioDashboard, {
  type IPortfolioDashboardProps,
  type IPortfolioDashboardSettings
} from './components/PortfolioDashboard';

export default class PortfolioDashboardWebPart extends BaseSectionWebPart<IPortfolioDashboardSettings> {
  protected get defaultProperties(): IPortfolioDashboardSettings {
    return {
      title: 'Acompanhe nosso Portfólio',
      subtitle: 'Visão consolidada das iniciativas por situação.',
      buttonText: 'Consultar Portfólio',
      buttonUrl: '',
      indicatorsTitle: 'Principais indicadores',
      panelLinkText: 'Ver painel completo',
      panelLinkUrl: '',
      statusChartTitle: 'Iniciativas por situação',
      objectiveChartTitle: 'Iniciativas por objetivo estratégico',
      listTitle: 'Iniciativas',
      statusField: 'Situacao',
      objectiveField: 'ObjetivoEstrategico',
      statuses: [
        { value: 'Registrada;Em análise;Em detalhamento;Elegível', label: 'Em análise', color: '#2b88d8' },
        { value: 'Priorizada;Selecionada;Em fila;Pendente de aprovação', label: 'Priorizadas', color: '#2e9e5b' },
        { value: 'Autorizada;Planejada', label: 'Planejadas', color: '#e3b505' },
        { value: 'Em andamento', label: 'Em andamento', color: '#0f5c8c' },
        { value: 'Concluída', label: 'Concluídas', color: '#14a38b' },
        { value: 'Suspensa', label: 'Suspensas', color: '#d64541' }
      ]
    };
  }

  protected renderSection(properties: IPortfolioDashboardSettings): React.ReactElement {
    const props: IPortfolioDashboardProps = {
      ...properties,
      spHttpClient: this.context.spHttpClient,
      webUrl: this.context.pageContext.web.absoluteUrl
    };
    return React.createElement(PortfolioDashboard, props);
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: { description: 'Painel com os indicadores do portfólio.' },
          groups: [
            {
              groupName: 'Textos e links',
              groupFields: [
                PropertyPaneTextField('title', { label: 'Título' }),
                PropertyPaneTextField('subtitle', { label: 'Descrição' }),
                PropertyPaneTextField('buttonText', { label: 'Texto do botão', description: 'Deixe em branco para ocultar o botão.' }),
                PropertyPaneTextField('buttonUrl', { label: 'Link do botão' }),
                PropertyPaneTextField('indicatorsTitle', { label: 'Título dos indicadores' }),
                PropertyPaneTextField('panelLinkText', { label: 'Texto do link do painel' }),
                PropertyPaneTextField('panelLinkUrl', { label: 'Link do painel completo (ex.: Power BI)' }),
                PropertyPaneTextField('statusChartTitle', { label: 'Título do gráfico por situação' }),
                PropertyPaneTextField('objectiveChartTitle', { label: 'Título do gráfico por objetivo' })
              ]
            },
            {
              groupName: 'Fonte de dados',
              groupFields: [
                PropertyPaneTextField('listTitle', { label: 'Nome da lista', description: 'Lista do site atual com as iniciativas.' }),
                PropertyPaneTextField('statusField', { label: 'Nome interno da coluna de situação' }),
                PropertyPaneTextField('objectiveField', { label: 'Nome interno da coluna de objetivo estratégico' }),
                PropertyFieldCollectionData('statuses', {
                  key: 'statuses',
                  label: 'Situações exibidas',
                  panelHeader: 'Situações exibidas',
                  panelDescription: 'O valor deve ser igual à opção da coluna de situação da lista; separe vários valores por ";".',
                  manageBtnLabel: 'Editar situações',
                  saveBtnLabel: 'Salvar',
                  saveAndAddBtnLabel: 'Salvar e adicionar',
                  cancelBtnLabel: 'Cancelar',
                  value: this.properties.statuses,
                  enableSorting: true,
                  fields: [
                    { id: 'value', title: 'Valor na lista', type: CustomCollectionFieldType.string, required: true },
                    { id: 'label', title: 'Rótulo', type: CustomCollectionFieldType.string, required: true },
                    { id: 'color', title: 'Cor', type: CustomCollectionFieldType.color, required: true }
                  ]
                })
              ]
            }
          ]
        }
      ]
    };
  }
}
