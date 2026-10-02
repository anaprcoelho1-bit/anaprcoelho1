import * as React from 'react';
import { type IPropertyPaneConfiguration } from '@microsoft/sp-property-pane';
import { type IPortfolioComponentProps, PortfolioWebPartBase } from '../../common/portfolio/PortfolioWebPartBase';
import PortfolioSelection, { type IPortfolioSelectionSettings } from './components/PortfolioSelection';

export default class PortfolioSelectionWebPart extends PortfolioWebPartBase<IPortfolioSelectionSettings> {
  protected get defaultProperties(): IPortfolioSelectionSettings {
    return {
      title: 'Seleção e balanceamento',
      subtitle: 'A lista priorizada confrontada com a capacidade real: o que entra, o que fica na fila e se o portfólio está equilibrado.',
      ...this.sourceDefaults()
    };
  }

  protected get component(): React.FC<IPortfolioComponentProps<IPortfolioSelectionSettings>> {
    return PortfolioSelection;
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: { description: 'Composição sugerida, capacidade e balanceamento.' },
          groups: [this.textGroup(), this.sourceGroup()]
        }
      ]
    };
  }
}
