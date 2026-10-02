import { IPropertyPaneField } from '@microsoft/sp-property-pane';
import {
  CustomCollectionFieldType,
  ICustomCollectionField,
  PropertyFieldCollectionData
} from '@pnp/spfx-property-controls/lib/PropertyFieldCollectionData';
import { ACCENT_OPTIONS } from './accents';
import { ISectionItem } from './types';

export interface IItemFieldsOptions {
  description?: boolean;
  icon?: boolean;
  url?: boolean;
  accent?: boolean;
}

/** Campo do painel de propriedades para editar uma lista de itens (cards, etapas, etc.). */
export function itemsField(
  targetProperty: string,
  label: string,
  value: ISectionItem[] | undefined,
  options: IItemFieldsOptions
): IPropertyPaneField<unknown> {
  const fields: ICustomCollectionField[] = [
    { id: 'title', title: 'Título', type: CustomCollectionFieldType.string, required: true }
  ];
  if (options.description) {
    fields.push({ id: 'description', title: 'Descrição', type: CustomCollectionFieldType.string });
  }
  if (options.icon) {
    fields.push({ id: 'icon', title: 'Ícone', type: CustomCollectionFieldType.fabricIcon, iconFieldRenderMode: 'picker' });
  }
  if (options.url) {
    fields.push({ id: 'url', title: 'Link', type: CustomCollectionFieldType.string, placeholder: 'https://...' });
  }
  if (options.accent) {
    fields.push({ id: 'accent', title: 'Cor', type: CustomCollectionFieldType.dropdown, options: ACCENT_OPTIONS });
  }

  return PropertyFieldCollectionData(targetProperty, {
    key: targetProperty,
    label,
    panelHeader: label,
    manageBtnLabel: `Editar ${label.toLowerCase()}`,
    saveBtnLabel: 'Salvar',
    saveAndAddBtnLabel: 'Salvar e adicionar',
    cancelBtnLabel: 'Cancelar',
    value: value ?? [],
    fields,
    enableSorting: true
  });
}
