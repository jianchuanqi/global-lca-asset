/** Minimal raw ToolDefinition adapter for out-of-tree DSH plugins. */
function compileValue(spec) {
    if (spec.type === 'json')
        return {};
    const result = { type: spec.type };
    if (spec.description !== undefined)
        result.description = spec.description;
    if (spec.type === 'object') {
        result.additionalProperties = spec.additionalProperties ?? true;
        const properties = {};
        const required = [];
        for (const [key, child] of Object.entries(spec.properties ?? {})) {
            properties[key] = compileValue(child);
            if (child.required === true)
                required.push(key);
        }
        result.properties = properties;
        if (required.length > 0)
            result.required = required;
    }
    if (spec.type === 'array' && spec.items !== undefined)
        result.items = compileValue(spec.items);
    return result;
}
function compileParameters(parameters) {
    const properties = {};
    const required = [];
    for (const [key, spec] of Object.entries(parameters)) {
        properties[key] = compileValue(spec);
        if (spec.required === true)
            required.push(key);
    }
    return { type: 'object', properties, ...(required.length === 0 ? {} : { required }) };
}
function validateValue(spec, value, path) {
    if (spec.type === 'json')
        return [];
    if (spec.type === 'null')
        return value === null ? [] : [`${path} must be null`];
    if (spec.type === 'string')
        return typeof value === 'string' ? [] : [`${path} must be a string`];
    if (spec.type === 'boolean')
        return typeof value === 'boolean' ? [] : [`${path} must be a boolean`];
    if (spec.type === 'number') {
        return typeof value === 'number' && Number.isFinite(value) ? [] : [`${path} must be a finite number`];
    }
    if (spec.type === 'integer') {
        return typeof value === 'number' && Number.isInteger(value) ? [] : [`${path} must be an integer`];
    }
    if (spec.type === 'array') {
        if (!Array.isArray(value))
            return [`${path} must be an array`];
        if (spec.items === undefined)
            return [];
        return value.flatMap((item, index) => validateValue(spec.items, item, `${path}[${index}]`));
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return [`${path} must be an object`];
    const object = value;
    const violations = [];
    for (const [key, child] of Object.entries(spec.properties ?? {})) {
        if (!(key in object)) {
            if (child.required === true)
                violations.push(`${path}.${key} is required`);
            continue;
        }
        violations.push(...validateValue(child, object[key], `${path}.${key}`));
    }
    if (spec.additionalProperties === false) {
        const allowed = new Set(Object.keys(spec.properties ?? {}));
        for (const key of Object.keys(object)) {
            if (!allowed.has(key))
                violations.push(`${path}.${key} is not allowed`);
        }
    }
    return violations;
}
/** Convert the compact author schema into DSH's public raw ToolDefinition fields. */
export function defineTool(options) {
    const parameterSpec = {
        type: 'object',
        additionalProperties: true,
        properties: options.parameters,
    };
    return {
        name: options.name,
        description: options.description,
        parameters: compileParameters(options.parameters),
        output: {
            schema: compileValue(options.output.schema),
            render: options.output.render,
            ...(options.output.presentationMeta === undefined ? {} : {
                presentationMeta: options.output.presentationMeta,
            }),
        },
        async execute(args, exec) {
            const violations = validateValue(parameterSpec, args, 'arguments');
            if (violations.length > 0)
                throw new Error(`invalid arguments: ${violations.join('; ')}`);
            return await options.execute(args, exec);
        },
        ...(options.presentCall === undefined ? {} : {
            presentCall(args) {
                if (validateValue(parameterSpec, args, 'arguments').length > 0)
                    return undefined;
                try {
                    return options.presentCall(args);
                }
                catch {
                    return undefined;
                }
            },
        }),
        ...(options.presentResult === undefined ? {} : {
            presentResult(args, result) {
                if (validateValue(parameterSpec, args, 'arguments').length > 0)
                    return undefined;
                try {
                    return options.presentResult(args, result);
                }
                catch {
                    return undefined;
                }
            },
        }),
        ...(options.isConcurrencySafe === undefined ? {} : {
            isConcurrencySafe(args) {
                if (validateValue(parameterSpec, args, 'arguments').length > 0)
                    return false;
                try {
                    return options.isConcurrencySafe(args) === true;
                }
                catch {
                    return false;
                }
            },
        }),
    };
}
//# sourceMappingURL=tool.js.map