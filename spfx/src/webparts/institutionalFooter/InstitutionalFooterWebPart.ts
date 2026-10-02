import * as React from 'react';
import {
  type IPropertyPaneConfiguration,
  PropertyPaneTextField
} from '@microsoft/sp-property-pane';
import { BaseSectionWebPart } from '../../common/BaseSectionWebPart';
import InstitutionalFooter, { type IInstitutionalFooterProps } from './components/InstitutionalFooter';

export default class InstitutionalFooterWebPart extends BaseSectionWebPart<IInstitutionalFooterProps> {
  protected get defaultProperties(): IInstitutionalFooterProps {
    return {
      logoUrl: '',
      logoAlt: 'Tribunal de Contas do Estado de Minas Gerais',
      orgShortName: 'TCEMG',
      orgName: 'Tribunal de Contas do Estado de Minas Gerais',
      centerTitle: 'Gestão de Portfólio',
      centerText: 'Iniciativas que geram valor para uma sociedade melhor.',
      unitShortName: 'CIPP',
      unitName: 'Coordenadoria Integrada de Projetos e Processos'
    };
  }

  protected renderSection(properties: IInstitutionalFooterProps): React.ReactElement {
    return React.createElement(InstitutionalFooter, properties);
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: { description: 'Rodapé institucional da página.' },
          groups: [
            {
              groupName: 'Instituição',
              groupFields: [
                PropertyPaneTextField('logoUrl', {
                  label: 'URL do logotipo',
                  description: 'Sem logotipo, é exibida a sigla e o nome da instituição.'
                }),
                PropertyPaneTextField('logoAlt', { label: 'Texto alternativo do logotipo' }),
                PropertyPaneTextField('orgShortName', { label: 'Sigla da instituição' }),
                PropertyPaneTextField('orgName', { label: 'Nome da instituição' })
              ]
            },
            {
              groupName: 'Textos',
              groupFields: [
                PropertyPaneTextField('centerTitle', { label: 'Título central' }),
                PropertyPaneTextField('centerText', { label: 'Texto central' }),
                PropertyPaneTextField('unitShortName', { label: 'Sigla da unidade' }),
                PropertyPaneTextField('unitName', { label: 'Nome da unidade' })
              ]
            }
          ]
        }
      ]
    };
  }
}
