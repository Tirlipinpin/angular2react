import React, { useEffect, useState } from 'react'
import * as angular from 'angular'
import kebabCase from 'lodash.kebabcase'
import { $injector as defaultInjector } from 'ngimport'

/**
 * Angular may try to bind back a value via 2-way binding, but React marks all
 * properties on `props` as non-configurable and non-writable.
 *
 * If we use a `Proxy` to intercept writes to these non-writable properties,
 * we run into an issue where the proxy throws when trying to write anyway,
 * even if we `return false`.
 *
 * Instead, we use the below ad-hoc proxy to catch writes to non-writable
 * properties in `object`, and log a helpful warning when it happens.
 */
 function writable(object) {
  const _object = {}
  for (const key in object) {
    if (object.hasOwnProperty(key)) {
      Object.defineProperty(_object, key, {
        get() { return object[key] },
        set(value) {
          let d = Object.getOwnPropertyDescriptor(object, key)
          if (d && d.writable) {
            return object[key] = value
          } else {
            console.warn(`Tried to write to non-writable property "${key}" of`, object, `. Consider using a callback instead of 2-way binding.`)
          }
        }
      })
    }
  }
  return _object
}

export function angular2react(componentName, component, $injector = defaultInjector) {
  return (props) => {
    const [didInitialCompile, setDidInitialCompile] = useState('')
    const [scope, setScope] = useState(null)

    useEffect(() => {
      setScope(Object.assign($injector.get('$rootScope').$new(true), { props: writable(props) }))

      return () => {
        if (!scope) {
          return
        }

        scope.$destroy()
      }
    }, [])

    useEffect(() => {
      if (!scope) {
        return
      }

      setScope({ ...scope, props: writable(props) })
    }, [props])

    const digest = () => {
      if (!scope) {
        return
      }
      try { scope.$digest() } catch (e) { }
    }

    const compile = (element) => {
      if (didInitialCompile || !scope) {
        return
      }

      $injector.get('$compile')(element)(scope)
      digest()
      setDidInitialCompile(true);
    }

    const bindings = useMemo(() => {
      let newBindings = {}

      if (component.bindings) {
        for (const binding in component.bindings) {
          newBindings[kebabCase(binding)] = `props.${binding}`
        }
      }

      return bindings
    }, [component.bindings])

    return (
      React.createElement(kebabCase(componentName),
        { ...bindings, ref: (ref) => compile = ref }
      )
    )
  }
}