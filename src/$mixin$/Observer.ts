const onBorderObserve = new WeakMap<HTMLElement, Function[]>(), onContentObserve = new WeakMap<HTMLElement, Function[]>();
const unwrapFromQuery = (element: any) => { if (typeof element?.current == "object") { element = element?.current ?? (typeof element?.self == "object" ? element?.self : null) ?? element; }; return element; }

// TODO: support of fragments
export const observeContentBox = (element, cb) => {
    if (!onContentObserve.has(element = unwrapFromQuery(element))) {
        const callbacks: Function[] = [];
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.contentBoxSize) {
                    const contentBoxSize = entry.contentBoxSize[0];
                    if (contentBoxSize) {
                        callbacks.forEach((cb) => cb?.(contentBoxSize, observer));
                    }
                }
            }
        });

        //
        cb?.({
            inlineSize: element.clientWidth/* - (getPxValue(element, "padding-left") + getPxValue(element, "padding-right"))*/,
            blockSize: element.clientHeight/* - (getPxValue(element, "padding-top") + getPxValue(element, "padding-bottom"))*/,
        }, observer);

        //
        onContentObserve.set(element, callbacks);
        observer.observe(element, {box: "content-box"});
    }

    //
    onContentObserve.get(element)?.push?.(cb);
    return { disconnect: ()=>(onContentObserve.get(element)?.splice?.(onContentObserve.get(element)?.indexOf(cb) || -1, 1)) };
};

// TODO: support of fragments
export const observeBorderBox = (element, cb) => {
    if (!onBorderObserve.has(element = unwrapFromQuery(element))) {
        const callbacks: Function[] = [];
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.borderBoxSize) {
                    const borderBoxSize = entry.borderBoxSize[0];
                    if (borderBoxSize) {
                        callbacks.forEach((cb) => cb?.(borderBoxSize, observer));
                    }
                }
            }
        });

        //
        cb?.({
            inlineSize: element.offsetWidth,
            blockSize: element.offsetHeight,
        }, observer);

        //
        onBorderObserve.set(element, callbacks);
        observer.observe(element, {box: "border-box"});
    }

    //
    onBorderObserve.get(element)?.push?.(cb);
    return { disconnect: ()=>(onBorderObserve.get(element)?.splice?.(onBorderObserve.get(element)?.indexOf(cb) || -1, 1)) };
}

/*
    const config = {
        attributeFilter: [attribute],
        attributeOldValue: true,
        attributes: true,
        childList: false,
        subtree: false,
    };
*/

//
export const observeAttribute = (element, attribute, cb) => {
    if (typeof element?.selector == "string") { return observeAttributeBySelector(element, element?.selector, attribute, cb); };

    //
    const attributeList = new Set<string>((attribute.split(",") || [attribute]).map((s) => s.trim()));
    const observer = new MutationObserver((mutationList, observer) => {
        for (const mutation of mutationList) {
            if (mutation.attributeName && attributeList.has(mutation.attributeName))
                { cb(mutation, observer); }
        }
    });

    //
    observer.observe(element = unwrapFromQuery(element), { attributes: true, attributeOldValue: true, attributeFilter: [...attributeList] });
    attributeList.forEach((attribute)=>cb({ target: element, type: "attributes", attributeName: attribute, oldValue: (element as HTMLElement)?.getAttribute?.(attribute) }, observer));
    return observer;
};

//
export const observeAttributeBySelector = (element, selector, attribute, cb) => {
    const attributeList = new Set<string>([...(attribute.split(",") || [attribute])].map((s) => s.trim()));
    const observer = new MutationObserver((mutationList, observer) => {
        for (const mutation of mutationList) {
            if (mutation.type == "childList") {
                const addedNodes   = Array.from(mutation.addedNodes)   || [];
                const removedNodes = Array.from(mutation.removedNodes) || [];

                //
                addedNodes.push(...Array.from(mutation.addedNodes || []).flatMap((el)=>Array.from((el as HTMLElement)?.querySelectorAll?.(selector) || []) as Element[]));
                removedNodes.push(...Array.from(mutation.removedNodes || []).flatMap((el)=>Array.from((el as HTMLElement)?.querySelectorAll?.(selector) || []) as Element[]));

                //
                [...new Set(addedNodes)]?.filter((el: any)=>el?.matches?.(selector))?.map?.((target)=>{
                    attributeList.forEach((attribute)=>{
                        cb({ target, type: "attributes", attributeName: attribute, oldValue: (target as HTMLElement)?.getAttribute?.(attribute) }, observer);
                    });
                });
            } else
            if ((mutation.target as HTMLElement)?.matches?.(selector) && (mutation.attributeName && attributeList.has(mutation.attributeName))) {
                cb(mutation, observer);
            }
        }
    });

    //
    observer.observe(element = unwrapFromQuery(element), {
        attributeOldValue: true,
        attributes: true,
        attributeFilter: [...attributeList],
        childList: true,
        subtree: true,
        characterData: true
    });

    //
    [...element.querySelectorAll(selector)].map((target)=>attributeList.forEach((attribute)=>cb({ target, type: "attributes", attributeName: attribute, oldValue: (target as HTMLElement)?.getAttribute?.(attribute) }, observer)));
    return observer;
};

//
export const observeBySelector = (element, selector = "*", cb = (mut, obs)=>{}) => {
    const observer = new MutationObserver((mutationList, observer) => {
        for (const mutation of mutationList) {
            if (mutation.type == "childList") {
                const $addedNodes   = Array.from(mutation.addedNodes)   || [];
                const $removedNodes = Array.from(mutation.removedNodes) || [];

                //
                $addedNodes.push(...Array.from(mutation.addedNodes || []).flatMap((el)=> Array.from((el as HTMLElement)?.querySelectorAll?.(selector) || []) as Element[]));
                $removedNodes.push(...Array.from(mutation.removedNodes || []).flatMap((el)=> Array.from((el as HTMLElement)?.querySelectorAll?.(selector) || []) as Element[]));

                //
                const addedNodes   = [...Array.from((new Set($addedNodes)).values())].filter((el) => (<HTMLElement>el)?.matches?.(selector));
                const removedNodes = [...Array.from((new Set($removedNodes)).values())].filter((el) => (<HTMLElement>el)?.matches?.(selector));

                //
                if (addedNodes.length > 0 || removedNodes.length > 0) {
                    cb?.({
                        type: mutation.type,
                        target: mutation.target,
                        attributeName: mutation.attributeName,
                        attributeNamespace: mutation.attributeNamespace,
                        nextSibling: mutation.nextSibling,
                        oldValue: mutation.oldValue,
                        previousSibling: mutation.previousSibling,
                        addedNodes, removedNodes,
                    }, observer);
                }
            }
        }
    });

    //
    observer.observe(element = unwrapFromQuery(element), { childList: true, subtree : true });
    const selected = Array.from(element.querySelectorAll(selector));
    if (selected.length > 0) { cb?.({ addedNodes: selected }, observer); };
    return observer;
};
