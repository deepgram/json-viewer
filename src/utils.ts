import { ComplexAttributeConverter } from 'lit';
import { JsonViewerState, SupportedTypes } from './types';

export function isRegex(obj: RegExp | any): boolean {
    return obj instanceof RegExp;
}

export function getType(obj: any): SupportedTypes {
    return obj === null
        ? SupportedTypes.Null
        : Array.isArray(obj)
        ? SupportedTypes.Array
        : (obj!.constructor.name.toLowerCase() as SupportedTypes);
}

export function isPrimitive(obj: any): boolean {
    return obj !== Object(obj);
}

export function isNode(obj: any): boolean {
    return !!obj && !!(obj as Node).nodeType;
}

export function isPrimitiveOrNode(obj: any): boolean {
    return isPrimitive(obj) || isNode(obj);
}

export function generateNodePreview(
    node: any,
    { nodeCount = 3, maxLength = 15 }: { nodeCount?: number; maxLength?: number } = {}
): string {
    const isArray = Array.isArray(node);
    const objectNodes = Object.keys(node);
    const keys = objectNodes.slice(0, nodeCount);
    const preview = [];

    const getNodePreview = (nodeValue: any) => {
        const nodeType = getType(nodeValue);

        switch (nodeType) {
            case SupportedTypes.Object:
                return Object.keys(nodeValue).length === 0 ? '{ }' : '{ ... }';
            case SupportedTypes.Array:
                return nodeValue.length === 0 ? '[ ]' : '[ ... ]';
            case SupportedTypes.String:
                return `"${nodeValue.substring(0, maxLength)}${nodeValue.length > maxLength ? '...' : ''}"`;
            default:
                return String(nodeValue);
        }
    };

    const childPreviews = [];
    for (const key of keys) {
        const nodePreview = [];
        const nodeValue = node[key];

        if (!isArray) nodePreview.push(`${key}: `);

        nodePreview.push(getNodePreview(nodeValue));
        childPreviews.push(nodePreview.join(''));
    }

    if (objectNodes.length > nodeCount) {
        childPreviews.push('...');
    }
    preview.push(childPreviews.join(', '));

    const previewText = preview.join('');

    return isArray ? `[ ${previewText} ]` : `{ ${previewText} }`;
}

export function* deepTraverse(obj: any): Generator<[any, string, string[]]> {
    const stack: Array<[any, string, string[]]> = [[obj, '', []]];

    while (stack.length) {
        const [node, path, parents] = stack.shift()!;

        if (path) {
            yield [node, path, parents];
        }

        if (!isPrimitive(node)) {
            for (const [key, value] of Object.entries(node)) {
                stack.push([value, `${path}${path ? '.' : ''}${key}`, [...parents, path]]);
            }
        }
    }
}

/**
 * Matches a string using a glob-like syntax)
 */
export function checkGlob(str: string, glob: string): boolean {
    const strParts = str.split('.');
    const globaParts = glob.split('.');

    const isStar = (s: string) => s === '*';
    const isGlobStar = (s: string) => s === '**';

    let strIndex = 0;
    let globIndex = 0;

    while (strIndex < strParts.length) {
        const globPart = globaParts[globIndex];
        const strPart = strParts[strIndex];

        if (globPart === strPart || isStar(globPart)) {
            globIndex++;
            strIndex++;
        } else if (isGlobStar(globPart)) {
            globIndex++;
            strIndex = strParts.length - (globaParts.length - globIndex);
        } else {
            return false;
        }
    }

    return globIndex === globaParts.length;
}

export const JSONConverter: ComplexAttributeConverter = {
    fromAttribute: (value: string): any => {
        return value && value.trim() ? JSON.parse(value) : undefined;
    },
    toAttribute: (value: any): string => {
        return JSON.stringify(value);
    }
};

export const isDefined = (value: any): boolean => value !== void 0;

export const isMatchingPath = (path: string, criteria: string | RegExp) =>
    isRegex(criteria) ? !!path.match(criteria as RegExp) : checkGlob(path, criteria as string);

export const isExpanded = (path: string, state: JsonViewerState): boolean => state.expanded[path];

export const isCollapsed = (path: string, state: JsonViewerState): boolean => !state.expanded[path];

export const isDeepestVisible = (node: Element): boolean => {
    const elementToCheck = node.querySelector('[part=object]');
    if (!elementToCheck) return true;
    return ![...node.children].includes(elementToCheck);
};

export const isAncestor = (currentElement: Element, compareElement: Element): boolean => {
    const currentPath = currentElement.getAttribute('data-path') || '';
    const comparePath = compareElement.getAttribute('data-path') || '';
    return currentPath.startsWith(comparePath) && currentElement.parentElement !== compareElement.parentElement;
};

export const isExpandedAndNonPrimitive = (path: string, shadowRoot: ShadowRoot): boolean => {
    const currentFocus = shadowRoot.querySelector(`[data-path="${path}"]`);
    const nextObject = currentFocus?.querySelector('[part=object]');
    if (!currentFocus || !nextObject) return false;
    return [...currentFocus.children].includes(nextObject);
};

export const isEmptyObject = (currentFocus: Element) => {
    const nestedIterable = currentFocus.querySelector('[part=object]');
    return !nestedIterable?.children || nestedIterable.children.length === 0;
};

export const isTopLevelElement = (path: string, shadowRoot: ShadowRoot): boolean => {
    const key = shadowRoot.querySelector(`[data-path="${path}"]`)?.querySelector('[part=key]');
    if (!(key instanceof HTMLElement)) return false;
    if (key.innerText.includes('.')) {
        const textPeriodCount = key.innerText.split('').filter((char) => char === '.').length;
        const pathPeriodCount = path.split('').filter((char) => char === '.').length;
        return textPeriodCount === pathPeriodCount;
    } else {
        return !path.includes('.');
    }
};

export const canNavigateDown = (path: string, shadowRoot: ShadowRoot): boolean => {
    const currentFocus = shadowRoot.querySelector(`[data-path="${path}"]`);
    const nextObject = currentFocus?.querySelector('[part=object]');
    if (!currentFocus || !nextObject) return false;
    return [...currentFocus.children].includes(nextObject) && !isEmptyObject(currentFocus);
};
