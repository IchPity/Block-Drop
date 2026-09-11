package game;

import java.awt.*;
import java.awt.image.BufferedImage;

public class Bauer extends Figur {
    boolean ersterZug = true;

    public Bauer(boolean isWhite, BufferedImage img) {
        super(isWhite, img);
    }

    public boolean isErsterZug() {
        return ersterZug;
    }

    public void setErsterZug(boolean ersterZug) {
        this.ersterZug = ersterZug;
    }


}
