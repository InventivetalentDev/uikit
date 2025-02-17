import { hasOwn, includes, isArray, isFunction, isString } from 'uikit-util';
import { registerComputed } from './computed';
import { registerWatch } from './watch';

export function initObservers(instance) {
    instance._observers = [];
    for (const observer of instance.$options.observe || []) {
        registerObservable(instance, observer);
    }
}

export function registerObserver(instance, ...observer) {
    instance._observers.push(...observer);
}

export function disconnectObservers(instance) {
    for (const observer of instance._observers) {
        observer.disconnect();
    }
}

function registerObservable(instance, observable) {
    let { observe, target = instance.$el, handler, options, filter, args } = observable;

    if (filter && !filter.call(instance, instance)) {
        return;
    }

    const key = `_observe${instance._observers.length}`;
    if (isFunction(target) && !hasOwn(instance, key)) {
        registerComputed(instance, key, () => target.call(instance, instance));
    }

    handler = isString(handler) ? instance[handler] : handler.bind(instance);

    if (isFunction(options)) {
        options = options.call(instance, instance);
    }

    const targets = hasOwn(instance, key) ? instance[key] : target;
    const observer = observe(targets, handler, options, args);

    if (isFunction(target) && isArray(instance[key])) {
        registerWatch(
            instance,
            { handler: updateTargets(observer, options), immediate: false },
            key,
        );
    }

    registerObserver(instance, observer);
}

function updateTargets(observer, options) {
    return (targets, prev) => {
        for (const target of prev) {
            if (!includes(targets, target)) {
                if (observer.unobserve) {
                    observer.unobserve(target);
                } else if (observer.observe) {
                    observer.disconnect();
                }
            }
        }

        for (const target of targets) {
            if (!includes(prev, target) || !observer.unobserve) {
                observer.observe(target, options);
            }
        }
    };
}
