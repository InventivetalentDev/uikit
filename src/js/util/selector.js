import { attr } from './attr';
import { index, matches } from './filter';
import { isDocument, isString, memoize, toNode, toNodes } from './lang';

export function query(selector, context) {
    return find(selector, getContext(selector, context));
}

export function queryAll(selector, context) {
    return findAll(selector, getContext(selector, context));
}

export function find(selector, context) {
    return toNode(_query(selector, toNode(context), 'querySelector'));
}

export function findAll(selector, context) {
    return toNodes(_query(selector, toNode(context), 'querySelectorAll'));
}

function getContext(selector, context = document) {
    return (isString(selector) && parseSelector(selector).isContextSelector) || isDocument(context)
        ? context
        : context.ownerDocument;
}

const addStarRe = /([!>+~-])(?=\s+[!>+~-]|\s*$)/g;
const splitSelectorRe = /.*?[^\\](?![^(]*\))(?:,|$)/g;
const trailingCommaRe = /\s*,$/;

const parseSelector = memoize((selector) => {
    selector = selector.replace(addStarRe, '$1 *');
    let isContextSelector = false;

    const selectors = [];
    for (let sel of selector.match(splitSelectorRe) ?? []) {
        sel = sel.replace(trailingCommaRe, '').trim();
        isContextSelector ||= ['!', '+', '~', '-', '>'].includes(sel[0]);
        selectors.push(sel);
    }

    return {
        selector: selectors.join(','),
        selectors,
        isContextSelector,
    };
});

const parsePositionSelector = memoize((selector) => {
    selector = selector.substr(1).trim();
    const index = selector.indexOf(' ');
    return ~index ? [selector.substring(0, index), selector.substring(index + 1)] : [selector, ''];
});

function _query(selector, context = document, queryFn) {
    if (!selector || !isString(selector)) {
        return selector;
    }

    const parsed = parseSelector(selector);

    if (!parsed.isContextSelector) {
        return _doQuery(context, queryFn, parsed.selector);
    }

    selector = '';
    const isSingle = parsed.selectors.length === 1;
    for (let sel of parsed.selectors) {
        let positionSel;
        let ctx = context;

        if (sel[0] === '!') {
            [positionSel, sel] = parsePositionSelector(sel);
            ctx = context.parentElement.closest(positionSel);
            if (!sel && isSingle) {
                return ctx;
            }
        }

        if (ctx && sel[0] === '-') {
            [positionSel, sel] = parsePositionSelector(sel);
            ctx = ctx.previousElementSibling;
            ctx = matches(ctx, positionSel) ? ctx : null;
            if (!sel && isSingle) {
                return ctx;
            }
        }

        if (!ctx) {
            continue;
        }

        if (isSingle) {
            if (sel[0] === '~' || sel[0] === '+') {
                sel = `:scope > :nth-child(${index(ctx) + 1}) ${sel}`;
                ctx = ctx.parentElement;
            } else if (sel[0] === '>') {
                sel = `:scope ${sel}`;
            }

            return _doQuery(ctx, queryFn, sel);
        }

        selector += `${selector ? ',' : ''}${domPath(ctx)} ${sel}`;
    }

    if (!isDocument(context)) {
        context = context.ownerDocument;
    }

    return _doQuery(context, queryFn, selector);
}

function _doQuery(context, queryFn, selector) {
    try {
        return context[queryFn](selector);
    } catch (e) {
        return null;
    }
}

function domPath(element) {
    const names = [];
    while (element.parentNode) {
        const id = attr(element, 'id');
        if (id) {
            names.unshift(`#${escape(id)}`);
            break;
        } else {
            let { tagName } = element;
            if (tagName !== 'HTML') {
                tagName += `:nth-child(${index(element) + 1})`;
            }
            names.unshift(tagName);
            element = element.parentNode;
        }
    }
    return names.join(' > ');
}

export function escape(css) {
    return isString(css) ? CSS.escape(css) : '';
}
