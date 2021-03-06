/**
 * Copyright (c) Tiny Technologies, Inc. All rights reserved.
 * Licensed under the LGPL or a commercial license.
 * For LGPL see License.txt in the project root for license information.
 * For commercial licenses see https://www.tiny.cloud/
 */

import { Arr, Obj } from '@ephox/katamari';
import { Editor } from 'tinymce/core/api/Editor';
import { getUserStyleFormats, isMergeStyleFormats } from '../../../api/Settings';
import { AllowedFormat, BlockStyleFormat, FormatReference, InlineStyleFormat, NestedFormatting, SelectorStyleFormat, Separator, StyleFormat } from './StyleFormatTypes';

export const defaultStyleFormats: AllowedFormat[] = [
  {
    title: 'Headings', items: [
      { title: 'Heading 1', format: 'h1' },
      { title: 'Heading 2', format: 'h2' },
      { title: 'Heading 3', format: 'h3' },
      { title: 'Heading 4', format: 'h4' },
      { title: 'Heading 5', format: 'h5' },
      { title: 'Heading 6', format: 'h6' }
    ]
  },

  {
    title: 'Inline', items: [
      { title: 'Bold', icon: 'bold', format: 'bold' },
      { title: 'Italic', icon: 'italic', format: 'italic' },
      { title: 'Underline', icon: 'underline', format: 'underline' },
      { title: 'Strikethrough', icon: 'strike-through', format: 'strikethrough' },
      { title: 'Superscript', icon: 'superscript', format: 'superscript' },
      { title: 'Subscript', icon: 'subscript', format: 'subscript' },
      { title: 'Code', icon: 'code', format: 'code' }
    ]
  },

  {
    title: 'Blocks', items: [
      { title: 'Paragraph', format: 'p' },
      { title: 'Blockquote', format: 'blockquote' },
      { title: 'Div', format: 'div' },
      { title: 'Pre', format: 'pre' }
    ]
  },

  {
    title: 'Align', items: [
      { title: 'Left', icon: 'align-left', format: 'alignleft' },
      { title: 'Center', icon: 'align-center', format: 'aligncenter' },
      { title: 'Right', icon: 'align-right', format: 'alignright' },
      { title: 'Justify', icon: 'align-justify', format: 'alignjustify' }
    ]
  }
];

// Note: Need to cast format below to Record, as Obj.has uses "K keyof T", which doesn't work with aliases
const isNestedFormat = (format: AllowedFormat): format is NestedFormatting => {
  return Obj.has(format as Record<string, any>, 'items');
};

const isBlockFormat = (format: AllowedFormat): format is BlockStyleFormat => {
  return Obj.has(format as Record<string, any>, 'block');
};

const isInlineFormat = (format: AllowedFormat): format is InlineStyleFormat => {
  return Obj.has(format as Record<string, any>, 'inline');
};

const isSelectorFormat = (format: AllowedFormat): format is SelectorStyleFormat => {
  return Obj.has(format as Record<string, any>, 'selector');
};

interface CustomFormatMapping {
  customFormats: { name: string, format: StyleFormat }[];
  formats: (Separator | FormatReference | NestedFormatting)[];
}

const mapFormats = (userFormats: AllowedFormat[]): CustomFormatMapping => {
  return Arr.foldl(userFormats, (acc, fmt) => {
    if (isNestedFormat(fmt)) {
      // Map the child formats
      const result = mapFormats(fmt.items);
      return {
        customFormats: acc.customFormats.concat(result.customFormats),
        formats: acc.formats.concat([{ title: fmt.title, items: result.formats }])
      };
    } else if (isInlineFormat(fmt) || isBlockFormat(fmt) || isSelectorFormat(fmt)) {
      // Convert the format to a reference and add the original to the custom formats to be registered
      const formatName = `custom-${fmt.title.toLowerCase()}`;
      return {
        customFormats: acc.customFormats.concat([{ name: formatName, format: fmt }]),
        formats: acc.formats.concat([{ title: fmt.title, format: formatName, icon: fmt.icon }])
      };
    } else {
      return { ...acc, formats: acc.formats.concat(fmt) };
    }
  }, { customFormats: [], formats: [] });
};

const registerCustomFormats = (editor: Editor, userFormats: AllowedFormat[]): (Separator | FormatReference | NestedFormatting)[] => {
  const result = mapFormats(userFormats);

  const registerFormats = (customFormats: {name: string, format: StyleFormat}[]) => {
    Arr.each(customFormats, (fmt) => {
      // Only register the custom format with the editor, if it's not already registered
      if (!editor.formatter.has(fmt.name)) {
        editor.formatter.register(fmt.name, fmt.format);
      }
    });
  };

  // The editor may not yet be initialized, so check for that
  if (editor.formatter) {
    registerFormats(result.customFormats);
  } else {
    editor.on('init', () => {
      registerFormats(result.customFormats);
    });
  }

  return result.formats;
};

export const getStyleFormats = (editor: Editor): (Separator | FormatReference | NestedFormatting)[] => {
  return getUserStyleFormats(editor).map((userFormats) => {
    // Ensure that any custom formats specified by the user are registered with the editor
    const registeredUserFormats = registerCustomFormats(editor, userFormats);
    // Merge the default formats with the custom formats if required
    return isMergeStyleFormats(editor) ? defaultStyleFormats.concat(registeredUserFormats) : registeredUserFormats;
  }).getOr(defaultStyleFormats);
};