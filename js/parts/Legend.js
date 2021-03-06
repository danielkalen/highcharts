/**
 * (c) 2010-2016 Torstein Honsi
 *
 * License: www.highcharts.com/license
 */
'use strict';
import H from './Globals.js';
import './Utilities.js';
var Legend,
		
	addEvent = H.addEvent,
	css = H.css,
	discardElement = H.discardElement,
	defined = H.defined,
	each = H.each,
	extend = H.extend,
	isFirefox = H.isFirefox,
	marginNames = H.marginNames,
	merge = H.merge,
	pick = H.pick,
	setAnimation = H.setAnimation,
	stableSort = H.stableSort,
	win = H.win,
	wrap = H.wrap;
/**
 * The overview of the chart's series.
 * @class
 */
Legend = H.Legend = function (chart, options) {
	this.init(chart, options);
};

Legend.prototype = {

	/**
	 * Initialize the legend
	 */
	init: function (chart, options) {

		this.chart = chart;
		
		this.setOptions(options);
		
		if (options.enabled) {
		
			// Render it
			this.render();

			// move checkboxes
			addEvent(this.chart, 'endResize', function () {
				this.legend.positionCheckboxes();
			});
		}
	},

	setOptions: function (options) {

		var padding = pick(options.padding, 8);

		this.options = options;
	
		/*= if (build.classic) { =*/
		this.itemStyle = options.itemStyle;
		this.itemHiddenStyle = merge(this.itemStyle, options.itemHiddenStyle);
		/*= } =*/
		this.itemMarginTop = options.itemMarginTop || 0;
		this.padding = padding;
		this.initialItemX = padding;
		this.initialItemY = padding - 5; // 5 is the number of pixels above the text
		this.maxItemWidth = 0;
		this.itemHeight = 0;
		this.symbolWidth = pick(options.symbolWidth, 16);
		this.pages = [];

	},

	/**
	 * Update the legend with new options. Equivalent to running chart.update with a legend
	 * configuration option.
	 * @param {Object} options Legend options
	 * @param {Boolean} redraw Whether to redraw the chart, defaults to true.
	 */
	update: function (options, redraw) {
		var chart = this.chart;

		this.setOptions(merge(true, this.options, options));
		this.destroy();
		chart.isDirtyLegend = chart.isDirtyBox = true;
		if (pick(redraw, true)) {
			chart.redraw();
		}
	},

	/**
	 * Set the colors for the legend item
	 * @param {Object} item A Series or Point instance
	 * @param {Object} visible Dimmed or colored
	 */
	colorizeItem: function (item, visible) {
		item.legendGroup[visible ? 'removeClass' : 'addClass']('highcharts-legend-item-hidden');

		/*= if (build.classic) { =*/
		var legend = this,
			options = legend.options,
			legendItem = item.legendItem,
			legendLine = item.legendLine,
			legendSymbol = item.legendSymbol,
			hiddenColor = legend.itemHiddenStyle.color,
			textColor = visible ? options.itemStyle.color : hiddenColor,
			symbolColor = visible ? (item.color || hiddenColor) : hiddenColor,
			markerOptions = item.options && item.options.marker,
			symbolAttr = { fill: symbolColor },
			key;

		if (legendItem) {
			legendItem.css({ fill: textColor, color: textColor }); // color for #1553, oldIE
		}
		if (legendLine) {
			legendLine.attr({ stroke: symbolColor });
		}

		if (legendSymbol) {

			// Apply marker options
			if (markerOptions && legendSymbol.isMarker) { // #585
				//symbolAttr.stroke = symbolColor;
				symbolAttr = item.pointAttribs();
				if (!visible) {
					for (key in symbolAttr) {
						symbolAttr[key] = hiddenColor;
					}
				}
			}

			legendSymbol.attr(symbolAttr);
		}
		/*= } =*/
	},

	/**
	 * Position the legend item
	 * @param {Object} item A Series or Point instance
	 */
	positionItem: function (item) {
		var legend = this,
			options = legend.options,
			symbolPadding = options.symbolPadding,
			ltr = !options.rtl,
			legendItemPos = item._legendItemPos,
			itemX = legendItemPos[0],
			itemY = legendItemPos[1],
			checkbox = item.checkbox,
			legendGroup = item.legendGroup;

		if (legendGroup && legendGroup.element) {
			legendGroup.translate(
				ltr ? itemX : legend.legendWidth - itemX - 2 * symbolPadding - 4,
				itemY
			);
		}

		if (checkbox) {
			checkbox.x = itemX;
			checkbox.y = itemY;
		}
	},

	/**
	 * Destroy a single legend item
	 * @param {Object} item The series or point
	 */
	destroyItem: function (item) {
		var checkbox = item.checkbox;

		// destroy SVG elements
		each(['legendItem', 'legendLine', 'legendSymbol', 'legendGroup'], function (key) {
			if (item[key]) {
				item[key] = item[key].destroy();
			}
		});

		if (checkbox) {
			discardElement(item.checkbox);
		}
	},

	/**
	 * Destroys the legend.
	 */
	destroy: function () {
		var legend = this,
			legendGroup = legend.group,
			box = legend.box;

		if (box) {
			legend.box = box.destroy();
		}

		// Destroy items
		each(this.getAllItems(), function (item) {
			each(['legendItem', 'legendGroup'], function (key) {
				if (item[key]) {
					item[key] = item[key].destroy();
				}
			});
		});

		if (legendGroup) {
			legend.group = legendGroup.destroy();
		}
		legend.display = null; // Reset in .render on update.
	},

	/**
	 * Position the checkboxes after the width is determined
	 */
	positionCheckboxes: function (scrollOffset) {
		var alignAttr = this.group && this.group.alignAttr,
			translateY,
			clipHeight = this.clipHeight || this.legendHeight,
			titleHeight = this.titleHeight;

		if (alignAttr) {
			translateY = alignAttr.translateY;
			each(this.allItems, function (item) {
				var checkbox = item.checkbox,
					top;

				if (checkbox) {
					top = translateY + titleHeight + checkbox.y + (scrollOffset || 0) + 3;
					css(checkbox, {
						left: (alignAttr.translateX + item.checkboxOffset + checkbox.x - 20) + 'px',
						top: top + 'px',
						display: top > translateY - 6 && top < translateY + clipHeight - 6 ? '' : 'none'
					});
				}
			});
		}
	},

	/**
	 * Render the legend title on top of the legend
	 */
	renderTitle: function () {
		var options = this.options,
			padding = this.padding,
			titleOptions = options.title,
			titleHeight = 0,
			bBox;

		if (titleOptions.text) {
			if (!this.title) {
				this.title = this.chart.renderer.label(titleOptions.text, padding - 3, padding - 4, null, null, null, null, null, 'legend-title')
					.attr({ zIndex: 1 })
					/*= if (build.classic) { =*/
					.css(titleOptions.style)
					/*= } =*/
					.add(this.group);
			}
			bBox = this.title.getBBox();
			titleHeight = bBox.height;
			this.offsetWidth = bBox.width; // #1717
			this.contentGroup.attr({ translateY: titleHeight });
		}
		this.titleHeight = titleHeight;
	},

	/**
	 * Set the legend item text
	 */
	setText: function (item) {
		var options = this.options;
		item.legendItem.attr({
			text: options.labelFormat ? H.format(options.labelFormat, item) : options.labelFormatter.call(item)
		});
	},

	/**
	 * Render a single specific legend item
	 * @param {Object} item A series or point
	 */
	renderItem: function (item) {
		var legend = this,
			chart = legend.chart,
			renderer = chart.renderer,
			options = legend.options,
			horizontal = options.layout === 'horizontal',
			symbolWidth = legend.symbolWidth,
			symbolPadding = options.symbolPadding,
			/*= if (build.classic) { =*/
			itemStyle = legend.itemStyle,
			itemHiddenStyle = legend.itemHiddenStyle,
			/*= } =*/
			padding = legend.padding,
			itemDistance = horizontal ? pick(options.itemDistance, 20) : 0,
			ltr = !options.rtl,
			itemHeight,
			widthOption = options.width,
			itemMarginBottom = options.itemMarginBottom || 0,
			itemMarginTop = legend.itemMarginTop,
			initialItemX = legend.initialItemX,
			bBox,
			itemWidth,
			li = item.legendItem,
			isSeries = !item.series,
			series = !isSeries && item.series.drawLegendSymbol ? item.series : item,
			seriesOptions = series.options,
			showCheckbox = legend.createCheckboxForItem && seriesOptions && seriesOptions.showCheckbox,
			useHTML = options.useHTML,
			fontSize = 12;

		if (!li) { // generate it once, later move it

			// Generate the group box
			// A group to hold the symbol and text. Text is to be appended in Legend class.
			item.legendGroup = renderer.g('legend-item')
				.addClass('highcharts-' + series.type + '-series highcharts-color-' + item.colorIndex +
					(item.options.className ? ' ' + item.options.className : '') +
					(isSeries ? ' highcharts-series-' + item.index : '')
				)
				.attr({ zIndex: 1 })
				.add(legend.scrollGroup);

			// Generate the list item text and add it to the group
			item.legendItem = li = renderer.text(
					'',
					ltr ? symbolWidth + symbolPadding : -symbolPadding,
					legend.baseline || 0,
					useHTML
				)
				/*= if (build.classic) { =*/
				.css(merge(item.visible ? itemStyle : itemHiddenStyle)) // merge to prevent modifying original (#1021)
				/*= } =*/
				.attr({
					align: ltr ? 'left' : 'right',
					zIndex: 2
				})
				.add(item.legendGroup);

			// Get the baseline for the first item - the font size is equal for all
			if (!legend.baseline) {
				/*= if (build.classic) { =*/
				fontSize = itemStyle.fontSize;
				/*= } =*/
				legend.fontMetrics = renderer.fontMetrics(
					fontSize,
					li
				);
				legend.baseline = legend.fontMetrics.f + 3 + itemMarginTop;
				li.attr('y', legend.baseline);
			}

			// Draw the legend symbol inside the group box
			series.drawLegendSymbol(legend, item);

			if (legend.setItemEvents) {
				legend.setItemEvents(item, li, useHTML);
			}			

			// add the HTML checkbox on top
			if (showCheckbox) {
				legend.createCheckboxForItem(item);
			}
		}

		// Colorize the items
		legend.colorizeItem(item, item.visible);

		// Always update the text
		legend.setText(item);

		// calculate the positions for the next line
		bBox = li.getBBox();

		itemWidth = item.checkboxOffset =
			options.itemWidth ||
			item.legendItemWidth ||
			symbolWidth + symbolPadding + bBox.width + itemDistance + (showCheckbox ? 20 : 0);
		legend.itemHeight = itemHeight = Math.round(item.legendItemHeight || bBox.height);

		// if the item exceeds the width, start a new line
		if (horizontal && legend.itemX - initialItemX + itemWidth >
				(widthOption || (chart.chartWidth - 2 * padding - initialItemX - options.x))) {
			legend.itemX = initialItemX;
			legend.itemY += itemMarginTop + legend.lastLineHeight + itemMarginBottom;
			legend.lastLineHeight = 0; // reset for next line (#915, #3976)
		}

		// If the item exceeds the height, start a new column
		/*if (!horizontal && legend.itemY + options.y + itemHeight > chart.chartHeight - spacingTop - spacingBottom) {
			legend.itemY = legend.initialItemY;
			legend.itemX += legend.maxItemWidth;
			legend.maxItemWidth = 0;
		}*/

		// Set the edge positions
		legend.maxItemWidth = Math.max(legend.maxItemWidth, itemWidth);
		legend.lastItemY = itemMarginTop + legend.itemY + itemMarginBottom;
		legend.lastLineHeight = Math.max(itemHeight, legend.lastLineHeight); // #915

		// cache the position of the newly generated or reordered items
		item._legendItemPos = [legend.itemX, legend.itemY];

		// advance
		if (horizontal) {
			legend.itemX += itemWidth;

		} else {
			legend.itemY += itemMarginTop + itemHeight + itemMarginBottom;
			legend.lastLineHeight = itemHeight;
		}

		// the width of the widest item
		legend.offsetWidth = widthOption || Math.max(
			(horizontal ? legend.itemX - initialItemX - itemDistance : itemWidth) + padding,
			legend.offsetWidth
		);
	},

	/**
	 * Get all items, which is one item per series for normal series and one item per point
	 * for pie series.
	 */
	getAllItems: function () {
		var allItems = [];
		each(this.chart.series, function (series) {
			var seriesOptions = series && series.options;

			// Handle showInLegend. If the series is linked to another series, defaults to false.
			if (series && pick(seriesOptions.showInLegend, !defined(seriesOptions.linkedTo) ? undefined : false, true)) {
				
				// Use points or series for the legend item depending on legendType
				allItems = allItems.concat(
						series.legendItems ||
						(seriesOptions.legendType === 'point' ?
								series.data :
								series)
				);
			}
		});
		return allItems;
	},

	/**
	 * Adjust the chart margins by reserving space for the legend on only one side
	 * of the chart. If the position is set to a corner, top or bottom is reserved
	 * for horizontal legends and left or right for vertical ones.
	 */
	adjustMargins: function (margin, spacing) {
		var chart = this.chart,
			options = this.options,
			// Use the first letter of each alignment option in order to detect the side
			alignment = options.align.charAt(0) + options.verticalAlign.charAt(0) + options.layout.charAt(0); // #4189 - use charAt(x) notation instead of [x] for IE7

		if (!options.floating) {

			each([
				/(lth|ct|rth)/,
				/(rtv|rm|rbv)/,
				/(rbh|cb|lbh)/,
				/(lbv|lm|ltv)/
			], function (alignments, side) {
				if (alignments.test(alignment) && !defined(margin[side])) {
					// Now we have detected on which side of the chart we should reserve space for the legend
					chart[marginNames[side]] = Math.max(
						chart[marginNames[side]],
						chart.legend[(side + 1) % 2 ? 'legendHeight' : 'legendWidth'] +
							[1, -1, -1, 1][side] * options[(side % 2) ? 'x' : 'y'] +
							pick(options.margin, 12) +
							spacing[side]
					);
				}
			});
		}
	},

	/**
	 * Render the legend. This method can be called both before and after
	 * chart.render. If called after, it will only rearrange items instead
	 * of creating new ones.
	 */
	render: function () {
		var legend = this,
			chart = legend.chart,
			renderer = chart.renderer,
			legendGroup = legend.group,
			allItems,
			display,
			legendWidth,
			legendHeight,
			box = legend.box,
			options = legend.options,
			padding = legend.padding;

		legend.itemX = legend.initialItemX;
		legend.itemY = legend.initialItemY;
		legend.offsetWidth = 0;
		legend.lastItemY = 0;

		if (!legendGroup) {
			legend.group = legendGroup = renderer.g('legend')
				.attr({ zIndex: 7 })
				.add();
			legend.contentGroup = renderer.g()
				.attr({ zIndex: 1 }) // above background
				.add(legendGroup);
			legend.scrollGroup = renderer.g()
				.add(legend.contentGroup);
		}

		legend.renderTitle();

		// add each series or point
		allItems = legend.getAllItems();

		// sort by legendIndex
		stableSort(allItems, function (a, b) {
			return ((a.options && a.options.legendIndex) || 0) - ((b.options && b.options.legendIndex) || 0);
		});

		// reversed legend
		if (options.reversed) {
			allItems.reverse();
		}

		legend.allItems = allItems;
		legend.display = display = !!allItems.length;

		// render the items
		legend.lastLineHeight = 0;
		each(allItems, function (item) {
			legend.renderItem(item);
		});

		// Get the box
		legendWidth = (options.width || legend.offsetWidth) + padding;
		legendHeight = legend.lastItemY + legend.lastLineHeight + legend.titleHeight;
		legendHeight = legend.handleOverflow(legendHeight);
		legendHeight += padding;

		// Draw the border and/or background
		if (!box) {
			legend.box = box = renderer.rect()
				.addClass('highcharts-legend-box')
				.attr({
					r: options.borderRadius
				})
				.add(legendGroup);
			box.isNew = true;
		} 

		/*= if (build.classic) { =*/
		// Presentational
		box
			.attr({
				stroke: options.borderColor,
				'stroke-width': options.borderWidth || 0,
				fill: options.backgroundColor || 'none'
			})
			.shadow(options.shadow);
		/*= } =*/

		if (legendWidth > 0 && legendHeight > 0) {
			box[box.isNew ? 'attr' : 'animate'](
				box.crisp({ x: 0, y: 0, width: legendWidth, height: legendHeight }, box.strokeWidth())
			);
			box.isNew = false;
		}

		// hide the border if no items
		box[display ? 'show' : 'hide']();

		/*= if (!build.classic) { =*/
		// Open for responsiveness
		if (legendGroup.getStyle('display') === 'none') {
			legendWidth = legendHeight = 0;
		}
		/*= } =*/

		legend.legendWidth = legendWidth;
		legend.legendHeight = legendHeight;

		// Now that the legend width and height are established, put the items in the
		// final position
		each(allItems, function (item) {
			legend.positionItem(item);
		});

		// 1.x compatibility: positioning based on style
		/*var props = ['left', 'right', 'top', 'bottom'],
			prop,
			i = 4;
		while (i--) {
			prop = props[i];
			if (options.style[prop] && options.style[prop] !== 'auto') {
				options[i < 2 ? 'align' : 'verticalAlign'] = prop;
				options[i < 2 ? 'x' : 'y'] = pInt(options.style[prop]) * (i % 2 ? -1 : 1);
			}
		}*/

		if (display) {
			legendGroup.align(extend({
				width: legendWidth,
				height: legendHeight
			}, options), true, 'spacingBox');
		}

		if (!chart.isResizing) {
			this.positionCheckboxes();
		}
	},

	/**
	 * Set up the overflow handling by adding navigation with up and down arrows below the
	 * legend.
	 */
	handleOverflow: function (legendHeight) {
		var legend = this,
			chart = this.chart,
			renderer = chart.renderer,
			options = this.options,
			optionsY = options.y,
			alignTop = options.verticalAlign === 'top',
			spaceHeight = chart.spacingBox.height + (alignTop ? -optionsY : optionsY) - this.padding,
			maxHeight = options.maxHeight,
			clipHeight,
			clipRect = this.clipRect,
			navOptions = options.navigation,
			animation = pick(navOptions.animation, true),
			arrowSize = navOptions.arrowSize || 12,
			nav = this.nav,
			pages = this.pages,
			padding = this.padding,
			lastY,
			allItems = this.allItems,
			clipToHeight = function (height) {
				if (height) {
					clipRect.attr({
						height: height
					});
				} else { // Reset (#5912)
					legend.clipRect = clipRect.destroy();
					legend.contentGroup.clip();
				}

				// useHTML
				if (legend.contentGroup.div) {
					legend.contentGroup.div.style.clip = height ? 
						'rect(' + padding + 'px,9999px,' +
							(padding + height) + 'px,0)' :
						'auto';
				}
			};


		// Adjust the height
		if (options.layout === 'horizontal' && options.verticalAlign !== 'middle' && !options.floating) {
			spaceHeight /= 2;
		}
		if (maxHeight) {
			spaceHeight = Math.min(spaceHeight, maxHeight);
		}

		// Reset the legend height and adjust the clipping rectangle
		pages.length = 0;
		if (legendHeight > spaceHeight && navOptions.enabled !== false) {

			this.clipHeight = clipHeight = Math.max(spaceHeight - 20 - this.titleHeight - padding, 0);
			this.currentPage = pick(this.currentPage, 1);
			this.fullHeight = legendHeight;

			// Fill pages with Y positions so that the top of each a legend item defines
			// the scroll top for each page (#2098)
			each(allItems, function (item, i) {
				var y = item._legendItemPos[1],
					h = Math.round(item.legendItem.getBBox().height),
					len = pages.length;

				if (!len || (y - pages[len - 1] > clipHeight && (lastY || y) !== pages[len - 1])) {
					pages.push(lastY || y);
					len++;
				}

				if (i === allItems.length - 1 && y + h - pages[len - 1] > clipHeight) {
					pages.push(y);
				}
				if (y !== lastY) {
					lastY = y;
				}
			});

			// Only apply clipping if needed. Clipping causes blurred legend in PDF export (#1787)
			if (!clipRect) {
				clipRect = legend.clipRect = renderer.clipRect(0, padding, 9999, 0);
				legend.contentGroup.clip(clipRect);
			}

			clipToHeight(clipHeight);

			// Add navigation elements
			if (!nav) {
				this.nav = nav = renderer.g().attr({ zIndex: 1 }).add(this.group);
				this.up = renderer.symbol('triangle', 0, 0, arrowSize, arrowSize)
					.on('click', function () {
						legend.scroll(-1, animation);
					})
					.add(nav);
				this.pager = renderer.text('', 15, 10)
					.addClass('highcharts-legend-navigation')
					/*= if (build.classic) { =*/
					.css(navOptions.style)
					/*= } =*/
					.add(nav);
				this.down = renderer.symbol('triangle-down', 0, 0, arrowSize, arrowSize)
					.on('click', function () {
						legend.scroll(1, animation);
					})
					.add(nav);
			}

			// Set initial position
			legend.scroll(0);

			legendHeight = spaceHeight;

		// Reset
		} else if (nav) {
			clipToHeight();
			nav.hide();
			this.scrollGroup.attr({
				translateY: 1
			});
			this.clipHeight = 0; // #1379
		}

		return legendHeight;
	},

	/**
	 * Scroll the legend by a number of pages
	 * @param {Object} scrollBy
	 * @param {Object} animation
	 */
	scroll: function (scrollBy, animation) {
		var pages = this.pages,
			pageCount = pages.length,
			currentPage = this.currentPage + scrollBy,
			clipHeight = this.clipHeight,
			navOptions = this.options.navigation,
			pager = this.pager,
			padding = this.padding,
			scrollOffset;

		// When resizing while looking at the last page
		if (currentPage > pageCount) {
			currentPage = pageCount;
		}

		if (currentPage > 0) {
			
			if (animation !== undefined) {
				setAnimation(animation, this.chart);
			}

			this.nav.attr({
				translateX: padding,
				translateY: clipHeight + this.padding + 7 + this.titleHeight,
				visibility: 'visible'
			});
			this.up.attr({
				'class': currentPage === 1 ? 'highcharts-legend-nav-inactive' : 'highcharts-legend-nav-active'
			});
			pager.attr({
				text: currentPage + '/' + pageCount
			});
			this.down.attr({
				'x': 18 + this.pager.getBBox().width, // adjust to text width
				'class': currentPage === pageCount ? 'highcharts-legend-nav-inactive' : 'highcharts-legend-nav-active'
			});

			/*= if (build.classic) { =*/
			this.up
				.attr({
					fill: currentPage === 1 ? navOptions.inactiveColor : navOptions.activeColor
				})
				.css({
					cursor: currentPage === 1 ? 'default' : 'pointer'
				});
			this.down
				.attr({
					fill: currentPage === pageCount ? navOptions.inactiveColor : navOptions.activeColor
				})
				.css({
					cursor: currentPage === pageCount ? 'default' : 'pointer'
				});
			/*= } =*/
			
			scrollOffset = -pages[currentPage - 1] + this.initialItemY;

			this.scrollGroup.animate({
				translateY: scrollOffset
			});

			this.currentPage = currentPage;
			this.positionCheckboxes(scrollOffset);
		}

	}

};

/*
 * LegendSymbolMixin
 */

H.LegendSymbolMixin = {

	/**
	 * Get the series' symbol in the legend
	 *
	 * @param {Object} legend The legend object
	 * @param {Object} item The series (this) or point
	 */
	drawRectangle: function (legend, item) {
		var options = legend.options,
			symbolHeight = options.symbolHeight || legend.fontMetrics.f,
			square = options.squareSymbol,
			symbolWidth = square ? symbolHeight : legend.symbolWidth;

		item.legendSymbol = this.chart.renderer.rect(
			square ? (legend.symbolWidth - symbolHeight) / 2 : 0,
			legend.baseline - symbolHeight + 1, // #3988
			symbolWidth,
			symbolHeight,
			pick(legend.options.symbolRadius, symbolHeight / 2)
		)
		.addClass('highcharts-point')
		.attr({
			zIndex: 3
		}).add(item.legendGroup);

	},

	/**
	 * Get the series' symbol in the legend. This method should be overridable to create custom
	 * symbols through Highcharts.seriesTypes[type].prototype.drawLegendSymbols.
	 *
	 * @param {Object} legend The legend object
	 */
	drawLineMarker: function (legend) {

		var options = this.options,
			markerOptions = options.marker,
			radius,
			legendSymbol,
			symbolWidth = legend.symbolWidth,
			renderer = this.chart.renderer,
			legendItemGroup = this.legendGroup,
			verticalCenter = legend.baseline - Math.round(legend.fontMetrics.b * 0.3),
			attr = {};

		// Draw the line
		/*= if (build.classic) { =*/
		attr = {
			'stroke-width': options.lineWidth || 0
		};
		if (options.dashStyle) {
			attr.dashstyle = options.dashStyle;
		}
		/*= } =*/
		
		this.legendLine = renderer.path([
			'M',
			0,
			verticalCenter,
			'L',
			symbolWidth,
			verticalCenter
		])
		.addClass('highcharts-graph')
		.attr(attr)
		.add(legendItemGroup);
		
		// Draw the marker
		if (markerOptions && markerOptions.enabled !== false) {
			radius = this.symbol.indexOf('url') === 0 ? 0 : markerOptions.radius;
			this.legendSymbol = legendSymbol = renderer.symbol(
				this.symbol,
				(symbolWidth / 2) - radius,
				verticalCenter - radius,
				2 * radius,
				2 * radius,
				markerOptions
			)
			.addClass('highcharts-point')
			.add(legendItemGroup);
			legendSymbol.isMarker = true;
		}
	}
};

// Workaround for #2030, horizontal legend items not displaying in IE11 Preview,
// and for #2580, a similar drawing flaw in Firefox 26.
// Explore if there's a general cause for this. The problem may be related
// to nested group elements, as the legend item texts are within 4 group elements.
if (/Trident\/7\.0/.test(win.navigator.userAgent) || isFirefox) {
	wrap(Legend.prototype, 'positionItem', function (proceed, item) {
		var legend = this,
			runPositionItem = function () { // If chart destroyed in sync, this is undefined (#2030)
				if (item._legendItemPos) {
					proceed.call(legend, item);
				}
			};

		// Do it now, for export and to get checkbox placement
		runPositionItem();

		// Do it after to work around the core issue
		setTimeout(runPositionItem);
	});
}
