// jules-custom-layout.js

// Custom layout mode to stretch a specific column
// This is a modified version of the built-in 'fitDataStretch' layout mode.
// Instead of stretching the last column, it stretches the column that has
// the 'stretchToFit' property set to true in its definition.

function fitDataStretchPath(columns, forced){
	var colsWidth = 0,
	tableWidth = this.table.rowManager.element.clientWidth,
	gap = 0,
	stretchCol = false;

    // Find the column that should be stretched
    stretchCol = columns.find(column => column.definition.stretchToFit);

	columns.forEach((column, i) => {
		if(!column.widthFixed){
			column.reinitializeWidth();
		}

		if(column.visible){
			colsWidth += column.getWidth();
		}
	});

	if(stretchCol){
		gap = tableWidth - colsWidth + stretchCol.getWidth();

		if(this.table.options.responsiveLayout && this.table.modExists("responsiveLayout", true)){
			stretchCol.setWidth(0);
			this.table.modules.responsiveLayout.update();
		}

		if(gap > 0){
			stretchCol.setWidth(gap);
		}else{
			stretchCol.reinitializeWidth();
		}
	}else{
		if(this.table.options.responsiveLayout && this.table.modExists("responsiveLayout", true)){
			this.table.modules.responsiveLayout.update();
		}
	}
}

// Register the custom layout mode with Tabulator
Tabulator.registerModule("layout", {
    modes: {
        fitDataStretchPath: fitDataStretchPath
    }
});
