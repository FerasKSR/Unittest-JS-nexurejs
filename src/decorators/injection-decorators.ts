import 'reflect-metadata';
import { Scope } from '../di/container.js';

/**
 * Metadata key for injection information
 */
const INJECTION_METADATA_KEY = Symbol('nexure:injection');

/**
 * Parameter injection metadata
 */
interface ParamInjectionMetadata {
  /**
   * Parameter index
   */
  index: number;

  /**
   * Parameter type
   */
  type: any;
}

/**
 * Injection metadata
 */
export interface InjectionMetadata {
  /**
   * Constructor parameter injections
   */
  params?: ParamInjectionMetadata[];

  /**
   * Property injections
   */
  properties?: Record<string | symbol, any>;

  /**
   * Provider scope
   */
  scope?: Scope;
}

/**
 * Get injection metadata from a target
 * @param target The target to get metadata from
 */
export function getInjectionMetadata(target: any): InjectionMetadata | undefined {
  return Reflect.getMetadata(INJECTION_METADATA_KEY, target);
}

/**
 * Set injection metadata on a target
 * @param metadata The metadata to set
 * @param target The target to set metadata on
 */
function setInjectionMetadata(metadata: Partial<InjectionMetadata>, target: any): void {
  const existingMetadata = getInjectionMetadata(target) || {};

  // Merge params
  if (metadata.params) {
    const params = [...(existingMetadata.params || []), ...metadata.params];
    existingMetadata.params = params;
  }

  // Merge properties
  if (metadata.properties) {
    existingMetadata.properties = {
      ...(existingMetadata.properties || {}),
      ...metadata.properties
    };
  }

  // Set scope
  if (metadata.scope) {
    existingMetadata.scope = metadata.scope;
  }

  Reflect.defineMetadata(INJECTION_METADATA_KEY, existingMetadata, target);
}

/**
 * Injectable decorator - marks a class as injectable
 * @param scope The provider scope
 */
export function Injectable(scope: Scope = Scope.SINGLETON): ClassDecorator {
  return (target: any) => {
    setInjectionMetadata({ scope }, target);
    return target;
  };
}

/**
 * Inject decorator - injects a dependency into a constructor parameter
 * @param token The token to inject
 */
export function Inject(token?: any): ParameterDecorator {
  return (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    // Get the parameter type from metadata
    const types = Reflect.getMetadata('design:paramtypes', target) || [];
    const paramType = token || types[parameterIndex];

    if (!paramType) {
      throw new Error(`Cannot determine type for parameter at index ${parameterIndex}`);
    }

    // Set the injection metadata
    setInjectionMetadata(
      {
        params: [
          {
            index: parameterIndex,
            type: paramType
          }
        ]
      },
      propertyKey ? target.constructor : target
    );
  };
}

/**
 * InjectProperty decorator - injects a dependency into a property
 * @param token The token to inject
 */
export function InjectProperty(token?: any): PropertyDecorator {
  return (target: any, propertyKey: string | symbol) => {
    // Get the property type from metadata
    const type = Reflect.getMetadata('design:type', target, propertyKey);
    const propertyType = token || type;

    if (!propertyType) {
      throw new Error(`Cannot determine type for property ${String(propertyKey)}`);
    }

    // Set the injection metadata
    const properties: Record<string | symbol, any> = {};
    properties[propertyKey] = propertyType;

    setInjectionMetadata({ properties }, target.constructor);
  };
}
