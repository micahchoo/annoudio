/**
 * Editor of the "Annoudio player" block.
 *
 * Plain ES5 with wp.element.createElement, no JSX: the plugin has no build step, so a
 * site maintainer can read and change the shipped file. The block is dynamic: save()
 * returns null, and PHP prints the snippet (includes/class-annoudio-block.php).
 */
( function ( wp ) {
	'use strict';

	var el = wp.element.createElement;
	var useState = wp.element.useState;
	var useEffect = wp.element.useEffect;
	var __ = wp.i18n.__;
	var sprintf = wp.i18n.sprintf;
	var useBlockProps = wp.blockEditor.useBlockProps;
	var c = wp.components;
	var config = window.annoudioConfig || { project: '', configured: false, settingsUrl: '' };

	/**
	 * Reads project, recording and src from the snippet that the Annoudio admin shows.
	 * Reads only the <annoudio-player> tag: the <script> line also has a src.
	 * Returns only the values it finds.
	 */
	function parseSnippet( text ) {
		var out = {};
		var tag = /<annoudio-player\b([^>]*)>/i.exec( text );
		if ( ! tag ) {
			return out;
		}
		[ 'project', 'recording', 'src' ].forEach( function ( name ) {
			var m = new RegExp( '\\s' + name + '\\s*=\\s*"([^"]*)"' ).exec( tag[ 1 ] );
			if ( m ) {
				out[ name ] = m[ 1 ].replace( /&quot;/g, '"' ).replace( /&#0?38;|&amp;/g, '&' ).trim();
			}
		} );
		return out;
	}

	/**
	 * Asks this site's REST route for the recording (title and audio address from the
	 * Annoudio admin). The stack is never called from here.
	 */
	function useRecordingCheck( recording ) {
		var state = useState( { status: 'idle' } );
		var check = state[ 0 ];
		var setCheck = state[ 1 ];
		useEffect(
			function () {
				if ( ! config.configured || ! recording ) {
					setCheck( { status: 'idle' } );
					return undefined;
				}
				var live = true;
				setCheck( { status: 'checking' } );
				var timer = setTimeout( function () {
					wp.apiFetch( { path: '/annoudio/v1/recordings/' + encodeURIComponent( recording ) } ).then(
						function ( result ) {
							if ( live ) {
								setCheck( { status: 'found', title: result.title, url: result.url } );
							}
						},
						function ( error ) {
							if ( live ) {
								setCheck( {
									status: 'error',
									notFound: !! ( error && error.data && error.data.status === 404 ),
									message: ( error && error.message ) || __( 'The check failed.', 'annoudio' ),
								} );
							}
						}
					);
				}, 400 );
				return function () {
					live = false;
					clearTimeout( timer );
				};
			},
			[ recording ]
		);
		return check;
	}

	function Status( props ) {
		var check = props.check;
		if ( check.status === 'checking' ) {
			return el( 'p', { className: 'annoudio-status' }, el( c.Spinner ), __( 'Checking the recording…', 'annoudio' ) );
		}
		if ( check.status === 'found' ) {
			return el( c.Notice, { status: 'success', isDismissible: false, className: 'annoudio-status' },
				el( 'p', null,
					/* translators: %s: recording title from the stack. */
					sprintf( __( 'Recording found: %s', 'annoudio' ), check.title ) ),
				el( 'p', { className: 'annoudio-src' },
					/* translators: %s: the audio address from the Annoudio admin. */
					sprintf( __( 'Audio address (from the Annoudio admin): %s', 'annoudio' ), check.url ) ) );
		}
		if ( check.status === 'error' ) {
			return el( c.Notice, { status: 'error', isDismissible: false, className: 'annoudio-status' }, check.message );
		}
		return null;
	}

	function Edit( props ) {
		var attributes = props.attributes;
		var setAttributes = props.setAttributes;
		var pasted = useState( '' );
		var check = useRecordingCheck( attributes.recording );
		var notes = [];

		// Keep a copy of the admin's audio address in the post: the page uses it only when
		// the stack does not answer (includes/class-annoudio-block.php, render).
		useEffect(
			function () {
				if ( check.status === 'found' && check.url !== attributes.src ) {
					setAttributes( { src: check.url } );
				} else if ( check.status === 'error' && check.notFound && attributes.src ) {
					setAttributes( { src: '' } );
				}
			},
			[ check.status, check.url ]
		);

		if ( ! config.configured ) {
			notes.push( el( c.Notice, { key: 'setup', status: 'warning', isDismissible: false },
				__( 'Annoudio is not set up. An administrator must type the stack address and the project in Settings, Annoudio.', 'annoudio' ),
				config.settingsUrl ? el( 'a', { href: config.settingsUrl, style: { marginLeft: '0.5em' } }, __( 'Open the settings', 'annoudio' ) ) : null ) );
		}
		var parsed = parseSnippet( pasted[ 0 ] );
		if ( parsed.project && config.project && parsed.project !== config.project ) {
			notes.push( el( c.Notice, { key: 'project', status: 'warning', isDismissible: false },
				/* translators: 1: project in the snippet, 2: project of this site. */
				sprintf( __( 'This snippet is for the project "%1$s". This site uses the project "%2$s". The block uses "%2$s".', 'annoudio' ), parsed.project, config.project ) ) );
		}

		return el( 'div', useBlockProps(),
			el( c.Placeholder, {
				icon: 'format-audio',
				label: __( 'Annoudio player', 'annoudio' ),
				instructions: __( 'Open the recording in the Annoudio admin. Type the number of "Recording ID:" from its Snippet panel. Or paste the full snippet.', 'annoudio' ),
				className: 'annoudio-player-editor',
			},
			el( 'div', { style: { width: '100%' } },
				notes,
				el( c.TextControl, {
					__nextHasNoMarginBottom: true,
					__next40pxDefaultSize: true,
					label: __( 'Recording ID', 'annoudio' ),
					help: __( 'A number, for example 1. The block gets the title and the audio address from the Annoudio admin.', 'annoudio' ),
					inputMode: 'numeric',
					value: attributes.recording,
					onChange: function ( value ) {
						// The stored audio address belongs to the old ID: the check fills the new one.
						setAttributes( { recording: value.trim(), src: '' } );
					},
				} ),
				el( c.TextareaControl, {
					__nextHasNoMarginBottom: true,
					label: __( 'Or paste the snippet', 'annoudio' ),
					help: __( 'The block reads the recording ID and the audio address from it. It keeps no other part of the text.', 'annoudio' ),
					value: pasted[ 0 ],
					rows: 3,
					onChange: function ( text ) {
						pasted[ 1 ]( text );
						var found = parseSnippet( text );
						if ( found.recording ) {
							setAttributes( { recording: found.recording, src: found.src || '' } );
						}
					},
				} ),
				el( Status, { check: check } )
			) )
		);
	}

	wp.blocks.registerBlockType( 'annoudio/player', {
		edit: Edit,
		save: function () {
			return null;
		},
	} );
} )( window.wp );
